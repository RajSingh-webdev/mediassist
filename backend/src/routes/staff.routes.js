import { Router } from "express";
import { getQueue, patchApproveEncounter } from "../controllers/staff.controller.js";

const router = Router();

router.get("/queue", getQueue);
router.patch("/encounters/:id/approve", patchApproveEncounter);

export default router;
