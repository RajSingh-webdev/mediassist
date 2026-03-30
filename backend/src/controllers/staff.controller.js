import { ZodError } from "zod";
import { approveEncounterSchema } from "../validators/staff.validator.js";
import { approveEncounter, getStaffQueue } from "../services/staff.service.js";

export async function getQueue(req, res, next) {
  try {
    const queue = await getStaffQueue();
    res.json(queue);
  } catch (err) {
    next(err);
  }
}

export async function patchApproveEncounter(req, res, next) {
  try {
    const data = approveEncounterSchema.parse(req.body);
    const result = await approveEncounter(req.params.id, data);
    res.json({
      message: "Encounter approved",
      token: result.encounter.token,
      encounter: result.encounter,
      patient: result.patient
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.issues });
    }
    next(err);
  }
}
