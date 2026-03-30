import { pool } from "../db/pool.js";
import crypto from "node:crypto";

export async function createCheckIn(data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const patientId = crypto.randomUUID();
    const encounterId = crypto.randomUUID();

    const patientResult = await client.query(
      `
      INSERT INTO patients (id, full_name, age, gender, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, full_name, age, gender, phone, created_at, updated_at
      `,
      [patientId, data.fullName, data.age, data.gender || null, data.phone || null]
    );

    const patient = patientResult.rows[0];
    const encounterResult = await client.query(
      `
      INSERT INTO encounters (id, patient_id, symptoms, allergies, conditions, medications, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED')
      RETURNING id, patient_id, symptoms, allergies, conditions, medications, token, status,
                approved_at, vitals_completed_at, consultation_at, created_at, updated_at
      `,
      [
        encounterId,
        patient.id,
        data.symptoms,
        data.allergies || null,
        data.conditions || null,
        data.medications || null
      ]
    );

    await client.query("COMMIT");
    const encounter = encounterResult.rows[0];

    return {
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
      updatedAt: encounter.updated_at,
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
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
