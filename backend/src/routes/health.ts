import { Router } from "express";

const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  response.json({ status: "ok", service: "learnforge-ai-api" });
});

export default healthRouter;
