import { Router } from "express";
import { getByToken, getTimeline } from "../controllers/encounter.controller.js";

const router = Router();

router.get("/by-token/:token", getByToken);
router.get("/:id/timeline", getTimeline);

export default router;
