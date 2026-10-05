import {Router} from "express";
import { createRealtimeToken } from "../controller/realtime.controller.js";

const router = Router();

router.get ("/token" , createRealtimeToken);

export default router;