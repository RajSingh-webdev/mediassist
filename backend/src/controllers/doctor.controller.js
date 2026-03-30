import { ZodError } from "zod";
import { upsertConsultationSchema } from "../validators/doctor.validator.js";
import { upsertConsultation } from "../services/doctor.service.js";

export async function patchConsultation(req, res, next) {
  try {
    const data = upsertConsultationSchema.parse(req.body);
    const consultation = await upsertConsultation(req.params.id, data);
    res.json({ message: "Consultation saved", consultation });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.issues });
    }
    next(err);
  }
}
