import express from "express";
import cors from "cors";

import { env } from "./src/config/env.js";
import geminiRoutes from "./src/routes/gemini.routes.js";

const app = express();

const allowedOrigins = env.clientUrl
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header
      // such as health checks/server-to-server requests.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(
        new Error(
          `CORS blocked origin: ${origin}`,
        ),
      );
    },
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

app.use("/api/gemini", geminiRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

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
      message:
        error instanceof Error
          ? error.message
          : "Internal server error.",
    });
  },
);

export default app;