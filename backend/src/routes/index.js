import { Router } from "express";
import healthRoutes from "./health.routes.js";
import patientRoutes from "./patient.routes.js";
import staffRoutes from "./staff.routes.js";
import encounterRoutes from "./encounter.routes.js";
import vitalsRoutes from "./vitals.routes.js";
import doctorRoutes from "./doctor.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/patients", patientRoutes);
router.use("/staff", staffRoutes);
router.use("/encounters", encounterRoutes);
router.use("/vitals", vitalsRoutes);
router.use("/doctor", doctorRoutes);

export default router;
