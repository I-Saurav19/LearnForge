import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.AUTH_SECRET = "test-only-secret-long-enough-for-authentication-tests";
});

import { compare, hash } from "bcryptjs";
import request from "supertest";
import { User } from "../models/User.js";
import app from "../app.js";

const student = {
  id: "507f1f77bcf86cd799439011",
  name: "Sam Student",
  email: "sam@example.com",
  password: "",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function mockFoundUser(user: typeof student | null) {
  const query = { select: vi.fn().mockResolvedValue(user) };
  vi.spyOn(User, "findOne").mockReturnValue(query as never);
}

describe("authentication API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    student.password = "";
  });

  it("registers a student, hashes the password, and never returns the hash", async () => {
    vi.spyOn(User, "findOne").mockResolvedValue(null as never);
    let persisted: Record<string, unknown> | undefined;
    vi.spyOn(User, "create").mockImplementation((async (data: Record<string, unknown>) => {
      persisted = data;
      return student;
    }) as never);

    const response = await request(app).post("/api/auth/register").send({
      name: "  Sam Student ", email: " SAM@Example.com ", password: "Study1234",
    });

    expect(response.status).toBe(201);
    expect(persisted?.email).toBe("sam@example.com");
    expect(persisted?.name).toBe("Sam Student");
    expect(persisted?.password).not.toBe("Study1234");
    expect(await compare("Study1234", String(persisted?.password))).toBe(true);
    expect(response.body.user).not.toHaveProperty("password");
    expect(JSON.stringify(response.body)).not.toContain(String(persisted?.password));
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");
    expect(response.headers["set-cookie"][0]).toContain("Max-Age=604800");
    if (process.env.NODE_ENV !== "production" && process.env.AUTH_COOKIE_SECURE !== "true") {
      expect(response.headers["set-cookie"][0]).not.toContain("Secure");
    }
  });

  it("rejects duplicate email registration", async () => {
    vi.spyOn(User, "findOne").mockResolvedValue(student as never);
    const response = await request(app).post("/api/auth/register").send({
      name: "Sam Student", email: "sam@example.com", password: "Study1234",
    });
    expect(response.status).toBe(409);
    expect(response.body).not.toHaveProperty("password");
  });

  it("logs in with valid credentials", async () => {
    const passwordHash = await hash("Study1234", 4);
    const savedStudent = { ...student, password: passwordHash };
    mockFoundUser(savedStudent);
    const response = await request(app).post("/api/auth/login").send({ email: "SAM@example.com", password: "Study1234" });
    expect(response.status).toBe(200);
    expect(response.body.user).not.toHaveProperty("password");
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
  });

  it("rejects invalid credentials", async () => {
    mockFoundUser(null);
    const response = await request(app).post("/api/auth/login").send({ email: "sam@example.com", password: "wrong-pass1" });
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Email or password is incorrect.");
  });

  it("loads the current user from the authenticated session", async () => {
    mockFoundUser({ ...student, password: await hash("Study1234", 4) });
    vi.spyOn(User, "findById").mockReturnValue({ select: vi.fn().mockResolvedValue(student) } as never);
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({ email: "sam@example.com", password: "Study1234" });
    expect(login.status).toBe(200);
    const response = await agent.get("/api/auth/me?id=507f1f77bcf86cd799439099");
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: student.id, name: student.name, email: student.email });
    expect(response.body.user).not.toHaveProperty("password");
  });

  it("rejects current-user requests without authentication", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required.");
  });

  it("rejects malformed or expired session tokens", async () => {
    const response = await request(app).get("/api/auth/me").set("Cookie", "learnforge_session=invalid-token");
    expect(response.status).toBe(401);
    expect(response.body.message).toContain("session is invalid or has expired");
  });

  it("clears the session on logout and rejects the cleared session", async () => {
    mockFoundUser({ ...student, password: await hash("Study1234", 4) });
    vi.spyOn(User, "findById").mockReturnValue({ select: vi.fn().mockResolvedValue(student) } as never);
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "sam@example.com", password: "Study1234" });
    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);
    expect(logout.headers["set-cookie"][0]).toContain("learnforge_session=");
    const currentUser = await agent.get("/api/auth/me");
    expect(currentUser.status).toBe(401);
  });

  it("rejects invalid form fields without creating an account", async () => {
    const create = vi.spyOn(User, "create");
    const missing = await request(app).post("/api/auth/register").send({ name: "Sam" });
    const invalidEmail = await request(app).post("/api/auth/register").send({ name: "Sam Student", email: "bad", password: "Study1234" });
    const weakPassword = await request(app).post("/api/auth/register").send({ name: "Sam Student", email: "sam@example.com", password: "password" });
    expect(missing.status).toBe(400);
    expect(invalidEmail.status).toBe(400);
    expect(weakPassword.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
