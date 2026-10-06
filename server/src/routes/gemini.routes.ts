import { Router } from "express";

import {
  createGeminiToken,
} from "../controller/gemini.controller.js";

const router = Router();

router.get(
  "/token",
  createGeminiToken,
);

export default router;