import { pool } from "../db/pool.js";
import crypto from "node:crypto";

export async function upsertVitals(encounterId, data) {
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query("BEGIN");
    inTransaction = true;

    const encounterResult = await client.query("SELECT id FROM encounters WHERE id = $1", [encounterId]);
    if (encounterResult.rowCount === 0) {
      const error = new Error("Encounter not found");
      error.status = 404;
      throw error;
    }

    const vitalsResult = await client.query(
      `
      INSERT INTO vitals (id, encounter_id, bp, hr, temp, spo2, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (encounter_id) DO UPDATE SET
        bp = EXCLUDED.bp,
        hr = EXCLUDED.hr,
        temp = EXCLUDED.temp,
        spo2 = EXCLUDED.spo2,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING id, encounter_id, bp, hr, temp, spo2, updated_by, created_at, updated_at
      `,
      [crypto.randomUUID(), encounterId, data.bp, data.hr, data.temp, data.spo2, data.updatedBy || null]
    );

    await client.query(
      `
      UPDATE encounters
      SET status = 'VITALS_DONE', vitals_completed_at = NOW(), updated_at = NOW()
      WHERE id = $1
      `,
      [encounterId]
    );

    await client.query("COMMIT");
    inTransaction = false;
    const vitals = vitalsResult.rows[0];
    return {
      id: vitals.id,
      encounterId: vitals.encounter_id,
      bp: vitals.bp,
      hr: vitals.hr,
      temp: vitals.temp,
      spo2: vitals.spo2,
      updatedBy: vitals.updated_by,
      createdAt: vitals.created_at,
      updatedAt: vitals.updated_at
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
