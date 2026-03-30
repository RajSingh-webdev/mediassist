import { ZodError } from "zod";
import { patientCheckInSchema } from "../validators/patient.validator.js";
import { createCheckIn } from "../services/patient.service.js";

export async function postCheckIn(req, res, next) {
  try {
    const data = patientCheckInSchema.parse(req.body);
    const encounter = await createCheckIn(data);
    res.status(201).json({ message: "Check-in submitted", encounter });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.issues });
    }
    next(err);
  }
}
