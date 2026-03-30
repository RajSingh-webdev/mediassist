import { ZodError } from "zod";
import { upsertVitalsSchema } from "../validators/vitals.validator.js";
import { upsertVitals } from "../services/vitals.service.js";

export async function patchVitals(req, res, next) {
  try {
    const data = upsertVitalsSchema.parse(req.body);
    const vitals = await upsertVitals(req.params.id, data);
    res.json({ message: "Vitals saved", vitals });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.issues });
    }
    next(err);
  }
}
