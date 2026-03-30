import { pool } from "../db/pool.js";
import crypto from "node:crypto";

export async function upsertConsultation(encounterId, data) {
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query("BEGIN");
    inTransaction = true;

    const encounterResult = await client.query(
      "SELECT id, status FROM encounters WHERE id = $1",
      [encounterId]
    );

    if (encounterResult.rowCount === 0) {
      const error = new Error("Encounter not found");
      error.status = 404;
      throw error;
    }

    const encounter = encounterResult.rows[0];
    if (encounter.status !== "VITALS_DONE" && encounter.status !== "CONSULTATION_DONE") {
      const error = new Error("Vitals are required before consultation");
      error.status = 400;
      throw error;
    }

    const consultationResult = await client.query(
      `
      INSERT INTO consultations (id, encounter_id, diagnosis, prescription, tests, advice, follow_up_notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (encounter_id) DO UPDATE SET
        diagnosis = EXCLUDED.diagnosis,
        prescription = EXCLUDED.prescription,
        tests = EXCLUDED.tests,
        advice = EXCLUDED.advice,
        follow_up_notes = EXCLUDED.follow_up_notes,
        created_by = EXCLUDED.created_by,
        updated_at = NOW()
      RETURNING id, encounter_id, diagnosis, prescription, tests, advice, follow_up_notes, created_by, created_at, updated_at
      `,
      [
        crypto.randomUUID(),
        encounterId,
        data.diagnosis,
        data.prescription,
        data.tests || null,
        data.advice || null,
        data.followUpNotes || null,
        data.createdBy || null
      ]
    );

    await client.query(
      `
      UPDATE encounters
      SET status = 'CONSULTATION_DONE', consultation_at = NOW(), updated_at = NOW()
      WHERE id = $1
      `,
      [encounterId]
    );

    await client.query("COMMIT");
    inTransaction = false;
    const consultation = consultationResult.rows[0];
    return {
      id: consultation.id,
      encounterId: consultation.encounter_id,
      diagnosis: consultation.diagnosis,
      prescription: consultation.prescription,
      tests: consultation.tests,
      advice: consultation.advice,
      followUpNotes: consultation.follow_up_notes,
      createdBy: consultation.created_by,
      createdAt: consultation.created_at,
      updatedAt: consultation.updated_at
    };
  } catch (error) {
    if (inTransaction) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
}
