import express from "express";
import cors from "cors";

import { env } from "./src/config/env.js";
import geminiRoutes from "./src/routes/gemini.routes.js";

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  }),
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Voice Agent API is running.",
  });
});

app.use(
  "/api/gemini",
  geminiRoutes,
);

app.use(
  (_req, res) => {
    res.status(404).json({
      success: false,
      message: "Route not found.",
    });
  },
);

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  },
);

export default app;