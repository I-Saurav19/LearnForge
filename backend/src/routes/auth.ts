import { compare, hash } from "bcryptjs";
import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { User, type UserDocument } from "../models/User.js";

const authRouter = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRounds = 12;
const defaultTokenMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

function tokenCookieMaxAge(): number {
  const match = /^(\d+)\s*(ms|s|m|h|d|w|y)?$/i.exec(env.authTokenTtl.trim());
  if (!match) return defaultTokenMaxAgeMs;
  const amount = Number(match[1]);
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    y: 31_557_600_000,
  };
  const unit = (match[2] ?? "ms").toLowerCase();
  const maxAge = amount * multipliers[unit]!;
  return Number.isSafeInteger(maxAge) && maxAge > 0 ? maxAge : defaultTokenMaxAgeMs;
}

function setSessionCookie(response: Response, userId: string): void {
  if (!env.authSecret) throw new Error("Auth configuration unavailable");
  const token = jwt.sign({}, env.authSecret, { subject: userId, expiresIn: env.authTokenTtl as jwt.SignOptions["expiresIn"] });
  response.cookie(env.authCookieName, token, {
    httpOnly: true,
    secure: env.authCookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: tokenCookieMaxAge(),
  });
}

function clearSessionCookie(response: Response): void {
  response.clearCookie(env.authCookieName, {
    httpOnly: true,
    secure: env.authCookieSecure,
    sameSite: "lax",
    path: "/",
  });
}

function publicUser(user: Pick<UserDocument, "name" | "email" | "createdAt"> & { id?: string; _id?: { toString(): string } }) {
  return { id: user.id ?? user._id?.toString(), name: user.name, email: user.email, createdAt: user.createdAt };
}

authRouter.post("/register", async (request: Request, response: Response) => {
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";

  if (!name || !email || !password) {
    response.status(400).json({ message: "Name, email, and password are required." });
    return;
  }
  if (name.length < 2 || name.length > 80) {
    response.status(400).json({ message: "Name must be between 2 and 80 characters." });
    return;
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    response.status(400).json({ message: "Enter a valid email address." });
    return;
  }
  if (password.length < 8 || password.length > 128 || Buffer.byteLength(password, "utf8") > 72 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    response.status(400).json({ message: "Password must be 8–72 bytes and include a letter and a number." });
    return;
  }

  try {
    if (await User.findOne({ email })) {
      response.status(409).json({ message: "An account with this email already exists." });
      return;
    }
    const passwordHash = await hash(password, passwordRounds);
    const user = await User.create({ name, email, password: passwordHash });
    setSessionCookie(response, user.id);
    response.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      response.status(409).json({ message: "An account with this email already exists." });
      return;
    }
    response.status(500).json({ message: "Unable to create your account right now." });
  }
});

authRouter.post("/login", async (request: Request, response: Response) => {
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  if (!email || !password) {
    response.status(400).json({ message: "Email and password are required." });
    return;
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    response.status(400).json({ message: "Enter a valid email address." });
    return;
  }

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await compare(password, user.password))) {
      response.status(401).json({ message: "Email or password is incorrect." });
      return;
    }
    setSessionCookie(response, user.id);
    response.json({ user: publicUser(user) });
  } catch {
    response.status(500).json({ message: "Unable to sign in right now." });
  }
});

authRouter.post("/logout", (_request: Request, response: Response) => {
  clearSessionCookie(response);
  response.status(200).json({ message: "You have been signed out." });
});

authRouter.get("/me", requireAuth, async (request: Request, response: Response) => {
  try {
    const user = await User.findById(request.userId).select("name email createdAt");
    if (!user) {
      response.status(401).json({ message: "Your session is invalid or has expired. Please sign in again." });
      return;
    }
    response.json({ user: publicUser(user) });
  } catch {
    response.status(500).json({ message: "Unable to load your account right now." });
  }
});

export default authRouter;
