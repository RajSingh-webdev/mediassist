# MediAssist Prototype Backend (PostgreSQL)

This is a prototype API backend for the patient flow:

1. Patient check-in
2. Staff approval + token generation
3. Vitals entry
4. Doctor consultation

## 1) Setup

```bash
cd backend
npm install
copy .env.example .env
```

Update `.env` with your PostgreSQL connection string if needed.

## 2) Prepare DB

Create the database (once):

```bash
createdb mediassist_proto
```

Apply schema:

```bash
psql "$DATABASE_URL" -f sql/schema.sql
```

## 3) Run

```bash
npm run dev
```

Server starts on `http://localhost:4000`.

## API (Prototype)

- `GET /health`
- `POST /patients/checkin`
- `GET /staff/queue`
- `PATCH /staff/encounters/:id/approve`
- `GET /encounters/by-token/:token`
- `GET /encounters/:id/timeline`
- `PATCH /vitals/encounters/:id`
- `PATCH /doctor/encounters/:id/consultation`

## Example Payloads

### Patient Check-in

```json
{
  "fullName": "Ali Khan",
  "age": 29,
  "gender": "Male",
  "phone": "03001234567",
  "symptoms": "Fever and sore throat for 2 days",
  "allergies": "Penicillin",
  "conditions": "Asthma",
  "medications": "Inhaler"
}
```

### Vitals

```json
{
  "bp": "120/80",
  "hr": 82,
  "temp": 99.1,
  "spo2": 98,
  "updatedBy": "Vitals Desk A"
}
```

### Consultation

```json
{
  "diagnosis": "Viral pharyngitis",
  "prescription": "Paracetamol 500mg SOS",
  "tests": "CBC",
  "advice": "Hydration and rest",
  "followUpNotes": "Follow up in 3 days if fever persists",
  "createdBy": "Dr. Ahmed"
}
```
