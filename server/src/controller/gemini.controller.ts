import type {
  Request,
  Response,
} from "express";

import {
  createGeminiLiveToken,
} from "../services/gemini.service.js";

export async function createGeminiToken(
  _req: Request,
  res: Response,
) {
  try {
    const result =
      await createGeminiLiveToken();

    res.status(200).json({
      success: true,
      token: result.token,
      model: result.model,
    });
  } catch (error) {
    console.error(
      "Gemini token error:",
      error,
    );

    res.status(500).json({
      success: false,

      message:
        error instanceof Error
          ? error.message
          : "Unable to create Gemini Live token.",
    });
  }
}