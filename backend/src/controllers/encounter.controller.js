import { getEncounterByToken, getEncounterTimeline } from "../services/encounter.service.js";

export async function getByToken(req, res, next) {
  try {
    const encounter = await getEncounterByToken(req.params.token);
    if (!encounter) {
      return res.status(404).json({ error: "Token not found" });
    }
    res.json(encounter);
  } catch (err) {
    next(err);
  }
}

export async function getTimeline(req, res, next) {
  try {
    const encounter = await getEncounterTimeline(req.params.id);
    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }
    res.json(encounter);
  } catch (err) {
    next(err);
  }
}
