import { Router } from "express";
import { postCheckIn } from "../controllers/patient.controller.js";

const router = Router();

router.post("/checkin", postCheckIn);

export default router;
