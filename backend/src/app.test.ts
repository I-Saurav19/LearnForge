import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "./app.js";
import { env } from "./config/env.js";

describe("API boundary handling", () => {
  it("exposes a basic health response without configuration details", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "learnforge-ai-api" });
    expect(JSON.stringify(response.body)).not.toMatch(/mongodb|gemini|secret|key/i);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
  });

  it("allows the configured frontend origin with credentials and does not wildcard origins", async () => {
    const allowed = await request(app).get("/api/health").set("Origin", env.frontendUrl);
    const other = await request(app).get("/api/health").set("Origin", "https://untrusted.example");
    expect(allowed.headers["access-control-allow-origin"]).toBe(env.frontendUrl);
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
    expect(other.headers["access-control-allow-origin"]).toBe(env.frontendUrl);
    expect(other.headers["access-control-allow-origin"]).not.toBe("https://untrusted.example");
  });

  it("rejects browser mutations from a different origin", async () => {
    const response = await request(app).post("/api/auth/logout").set("Origin", "https://untrusted.example");
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Request origin is not allowed." });
  });

  it("returns a consistent JSON response for unknown API endpoints", async () => {
    const response = await request(app).get("/api/not-a-route");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "API endpoint not found." });
  });

  it("returns safe JSON errors for malformed and oversized JSON bodies", async () => {
    const malformed = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad json");
    const oversized = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ value: "x".repeat(300 * 1024) }));

    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ message: "Request body must contain valid JSON." });
    expect(oversized.status).toBe(413);
    expect(oversized.body).toEqual({ message: "Request body is too large." });
  });
});
