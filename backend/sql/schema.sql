CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 0 AND age <= 120),
  gender TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  symptoms TEXT NOT NULL,
  allergies TEXT,
  conditions TEXT,
  medications TEXT,
  token TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED', 'APPROVED', 'VITALS_DONE', 'CONSULTATION_DONE')),
  approved_at TIMESTAMPTZ,
  vitals_completed_at TIMESTAMPTZ,
  consultation_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vitals (
  id TEXT PRIMARY KEY,
  encounter_id TEXT UNIQUE NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  bp TEXT NOT NULL,
  hr INTEGER NOT NULL,
  temp DOUBLE PRECISION NOT NULL,
  spo2 INTEGER NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consultations (
  id TEXT PRIMARY KEY,
  encounter_id TEXT UNIQUE NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  diagnosis TEXT NOT NULL,
  prescription TEXT NOT NULL,
  tests TEXT,
  advice TEXT,
  follow_up_notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patients_updated_at ON patients;
CREATE TRIGGER trg_patients_updated_at
BEFORE UPDATE ON patients
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_encounters_updated_at ON encounters;
CREATE TRIGGER trg_encounters_updated_at
BEFORE UPDATE ON encounters
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vitals_updated_at ON vitals;
CREATE TRIGGER trg_vitals_updated_at
BEFORE UPDATE ON vitals
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_consultations_updated_at ON consultations;
CREATE TRIGGER trg_consultations_updated_at
BEFORE UPDATE ON consultations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
