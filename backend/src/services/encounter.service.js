import { pool } from "../db/pool.js";

function mapEncounterRow(row) {
  return {
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
          updatedBy: row.vital_updated_by,
          createdAt: row.vital_created_at,
          updatedAt: row.vital_updated_at
        }
      : null,
    consultation: row.consultation_id
      ? {
          id: row.consultation_id,
          encounterId: row.encounter_id,
          diagnosis: row.diagnosis,
          prescription: row.prescription,
          tests: row.tests,
          advice: row.advice,
          followUpNotes: row.follow_up_notes,
          createdBy: row.created_by,
          createdAt: row.consultation_created_at,
          updatedAt: row.consultation_updated_at
        }
      : null
  };
}

export async function getEncounterByToken(token) {
  const result = await pool.query(
    `
    SELECT
      e.id AS encounter_id, e.patient_id, e.symptoms, e.allergies, e.conditions, e.medications,
      e.token, e.status, e.approved_at, e.vitals_completed_at, e.consultation_at,
      e.created_at AS encounter_created_at, e.updated_at AS encounter_updated_at,
      p.id AS patient_id_ref, p.full_name, p.age, p.gender, p.phone,
      p.created_at AS patient_created_at, p.updated_at AS patient_updated_at,
      v.id AS vital_id, v.bp, v.hr, v.temp, v.spo2, v.updated_by AS vital_updated_by,
      v.created_at AS vital_created_at, v.updated_at AS vital_updated_at,
      c.id AS consultation_id, c.diagnosis, c.prescription, c.tests, c.advice, c.follow_up_notes,
      c.created_by, c.created_at AS consultation_created_at, c.updated_at AS consultation_updated_at
    FROM encounters e
    JOIN patients p ON p.id = e.patient_id
    LEFT JOIN vitals v ON v.encounter_id = e.id
    LEFT JOIN consultations c ON c.encounter_id = e.id
    WHERE e.token = $1
    `,
    [token.toUpperCase()]
  );

  if (result.rowCount === 0) {
    return null;
  }
  return mapEncounterRow(result.rows[0]);
}

export async function getEncounterTimeline(encounterId) {
  const result = await pool.query(
    `
    SELECT
      e.id AS encounter_id, e.patient_id, e.symptoms, e.allergies, e.conditions, e.medications,
      e.token, e.status, e.approved_at, e.vitals_completed_at, e.consultation_at,
      e.created_at AS encounter_created_at, e.updated_at AS encounter_updated_at,
      p.id AS patient_id_ref, p.full_name, p.age, p.gender, p.phone,
      p.created_at AS patient_created_at, p.updated_at AS patient_updated_at,
      v.id AS vital_id, v.bp, v.hr, v.temp, v.spo2, v.updated_by AS vital_updated_by,
      v.created_at AS vital_created_at, v.updated_at AS vital_updated_at,
      c.id AS consultation_id, c.diagnosis, c.prescription, c.tests, c.advice, c.follow_up_notes,
      c.created_by, c.created_at AS consultation_created_at, c.updated_at AS consultation_updated_at
    FROM encounters e
    JOIN patients p ON p.id = e.patient_id
    LEFT JOIN vitals v ON v.encounter_id = e.id
    LEFT JOIN consultations c ON c.encounter_id = e.id
    WHERE e.id = $1
    `,
    [encounterId]
  );

  if (result.rowCount === 0) {
    return null;
  }
  return mapEncounterRow(result.rows[0]);
}
