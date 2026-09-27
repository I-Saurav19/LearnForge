import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(request: Request, response: Response, next: NextFunction): Promise<void> {
  const token = request.cookies?.[env.authCookieName] as string | undefined;
  if (!token || !env.authSecret) {
    response.status(401).json({ message: "Authentication required." });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.authSecret) as JwtPayload;
  } catch {
    response.status(401).json({ message: "Your session is invalid or has expired. Please sign in again." });
    return;
  }
  if (typeof payload.sub !== "string") {
    response.status(401).json({ message: "Your session is invalid or has expired. Please sign in again." });
    return;
  }

  try {
    const user = await User.findById(payload.sub).select("_id");
    if (!user) {
      response.status(401).json({ message: "Your session is invalid or has expired. Please sign in again." });
      return;
    }
    request.userId = user.id;
    next();
  } catch {
    response.status(500).json({ message: "Unable to verify your session right now." });
  }
}
