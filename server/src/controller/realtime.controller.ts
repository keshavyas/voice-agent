import type { Request, Response } from "express";
import { createRealtimeClientSecret } from "../services/openai.service.js";

export async function createRealtimeToken(
_req: Request,
res: Response,
) {
try {
    const result = await createRealtimeClientSecret();

    res.status(200).json({
    success: true,
    clientSecret: result.clientSecret,
    expiresAt: result.expiresAt,
    });
} catch (error) {
    console.error("Realtime token error:", error);

    res.status(500).json({
    success: false,
    message:
        error instanceof Error
        ? error.message
        : "Unable to create realtime token.",
    });
}
}
