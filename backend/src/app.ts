import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { env } from "./config/env.js";
import authRouter from "./routes/auth.js";
import documentRouter from "./routes/documents.js";
import healthRouter from "./routes/health.js";
import coursesRouter from "./routes/courses.js";
import aiRouter from "./routes/ai.js";
import quizzesRouter from "./routes/quizzes.js";
import type { ErrorRequestHandler } from "express";

const app = express();

app.disable("x-powered-by");
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use((request, response, next) => {
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const origin = request.get("Origin");
  if (isMutation && origin && origin !== env.frontendUrl) {
    response.status(403).json({ message: "Request origin is not allowed." });
    return;
  }
  next();
});
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/documents", documentRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/ai", aiRouter);
app.use("/api/quizzes", quizzesRouter);
app.use("/api", (_request, response) => {
  response.status(404).json({ message: "API endpoint not found." });
});
const apiErrorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  if (response.headersSent) return;
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
    ? error.status
    : 500;
  if (status === 400) {
    response.status(400).json({ message: "Request body must contain valid JSON." });
    return;
  }
  if (status === 413) {
    response.status(413).json({ message: "Request body is too large." });
    return;
  }
  console.error(`Unhandled API error for ${request.method} ${request.path}.`);
  response.status(500).json({ message: "Something went wrong. Please try again." });
};
app.use("/api", apiErrorHandler);

export default app;
