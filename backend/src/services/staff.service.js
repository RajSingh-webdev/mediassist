import { pool } from "../db/pool.js";
import { generateToken } from "../utils/token.js";

export async function getStaffQueue() {
  const result = await pool.query(
    `
    SELECT
      e.id AS encounter_id, e.patient_id, e.symptoms, e.allergies, e.conditions, e.medications,
      e.token, e.status, e.approved_at, e.vitals_completed_at, e.consultation_at,
      e.created_at AS encounter_created_at, e.updated_at AS encounter_updated_at,
      p.id AS patient_id_ref, p.full_name, p.age, p.gender, p.phone,
      p.created_at AS patient_created_at, p.updated_at AS patient_updated_at,
      v.id AS vital_id, v.bp, v.hr, v.temp, v.spo2, v.updated_by,
      v.created_at AS vital_created_at, v.updated_at AS vital_updated_at
    FROM encounters e
    JOIN patients p ON p.id = e.patient_id
    LEFT JOIN vitals v ON v.encounter_id = e.id
    WHERE e.status IN ('SUBMITTED', 'APPROVED')
    ORDER BY e.created_at ASC
    `
  );

  return result.rows.map((row) => ({
    id: row.encounter_id,
    patientId: row.patient_id,
    symptoms: row.symptoms,
    allergies: row.allergies,
    conditions: row.conditions,
    medications: row.medications,
    token: row.token,
    status: row.status,
    approvedAt: row.approved_at,
    vitalsCompletedAt: row.vitals_completed_at,
    consultationAt: row.consultation_at,
    createdAt: row.encounter_created_at,
    updatedAt: row.encounter_updated_at,
    patient: {
      id: row.patient_id_ref,
      fullName: row.full_name,
      age: row.age,
      gender: row.gender,
      phone: row.phone,
      createdAt: row.patient_created_at,
      updatedAt: row.patient_updated_at
    },
    vitals: row.vital_id
      ? {
          id: row.vital_id,
          encounterId: row.encounter_id,
          bp: row.bp,
          hr: row.hr,
          temp: row.temp,
          spo2: row.spo2,
          updatedBy: row.updated_by,
          createdAt: row.vital_created_at,
          updatedAt: row.vital_updated_at
        }
      : null
  }));
}

export async function approveEncounter(encounterId, data) {
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query("BEGIN");
    inTransaction = true;

    const existingResult = await client.query(
      `
      SELECT
        e.id, e.patient_id, e.symptoms, e.allergies, e.conditions, e.medications, e.token,
        p.full_name, p.age, p.gender, p.phone
      FROM encounters e
      JOIN patients p ON p.id = e.patient_id
      WHERE e.id = $1
      `,
      [encounterId]
    );

    if (existingResult.rowCount === 0) {
      const error = new Error("Encounter not found");
      error.status = 404;
      throw error;
    }

    const existing = existingResult.rows[0];
    let token = existing.token;
    if (!token) {
      token = generateToken();
      for (let i = 0; i < 10; i += 1) {
        const tokenCheck = await client.query("SELECT id FROM encounters WHERE token = $1", [token]);
        if (tokenCheck.rowCount === 0) {
          break;
        }
        token = generateToken();
      }
    }

    const encounterUpdate = await client.query(
      `
      UPDATE encounters
      SET
        token = $1,
        status = 'APPROVED',
        approved_at = NOW(),
        symptoms = $2,
        allergies = $3,
        conditions = $4,
        medications = $5,
        updated_at = NOW()
      WHERE id = $6
      RETURNING id, patient_id, symptoms, allergies, conditions, medications, token, status,
                approved_at, vitals_completed_at, consultation_at, created_at, updated_at
      `,
      [
        token,
        data.symptoms ?? existing.symptoms,
        data.allergies ?? existing.allergies,
        data.conditions ?? existing.conditions,
        data.medications ?? existing.medications,
        encounterId
      ]
    );

    const patientUpdate = await client.query(
      `
      UPDATE patients
      SET
        full_name = $1,
        age = $2,
        gender = $3,
        phone = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING id, full_name, age, gender, phone, created_at, updated_at
      `,
      [
        data.fullName ?? existing.full_name,
        data.age ?? existing.age,
        data.gender ?? existing.gender,
        data.phone ?? existing.phone,
        existing.patient_id
      ]
    );

    await client.query("COMMIT");
    inTransaction = false;
    const encounter = encounterUpdate.rows[0];
    const patient = patientUpdate.rows[0];

    return {
      encounter: {
        id: encounter.id,
        patientId: encounter.patient_id,
        symptoms: encounter.symptoms,
        allergies: encounter.allergies,
        conditions: encounter.conditions,
        medications: encounter.medications,
        token: encounter.token,
        status: encounter.status,
        approvedAt: encounter.approved_at,
        vitalsCompletedAt: encounter.vitals_completed_at,
        consultationAt: encounter.consultation_at,
        createdAt: encounter.created_at,
        updatedAt: encounter.updated_at
      },
      patient: {
        id: patient.id,
        fullName: patient.full_name,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
        createdAt: patient.created_at,
        updatedAt: patient.updated_at
      }
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
