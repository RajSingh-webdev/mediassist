import { Router } from "express";
import { patchConsultation } from "../controllers/doctor.controller.js";

const router = Router();

router.patch("/encounters/:id/consultation", patchConsultation);

export default router;
