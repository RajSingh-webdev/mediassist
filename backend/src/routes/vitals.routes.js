import { Router } from "express";
import { patchVitals } from "../controllers/vitals.controller.js";

const router = Router();

router.patch("/encounters/:id", patchVitals);

export default router;
