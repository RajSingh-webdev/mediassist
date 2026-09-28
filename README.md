# MediAssist

MediAssist is an intelligent clinic workflow and clinical history management system designed to streamline patient intake, vitals tracking, queue management, and doctor consultations.

---

## 🌟 Key Features

- **Central Launcher (`index.html`)**: Navigation hub connecting all clinical roles and portals.
- **Patient Portal (`patient.html`)**: Quick self-service registration and patient details entry.
- **Staff / Intake Station (`staff.html`)**: Patient check-in, token generation, queue tracking, and voice intake transcription.
- **Vitals Desk (`vital.html`)**: Recording critical patient vitals (Blood Pressure, Heart Rate, SpO2, Temperature, Weight, Blood Sugar) before doctor handoff.
- **Doctor Consultation Dashboard (`doctor.html`)**: Real-time queue view, patient history, vitals inspection, prescription writing, and consultation workflow.
- **Supabase Cloud Backend (`backend/server.js`)**: Real-time relational database persistence for patients, visits, vitals, and queue tokens.
- **Voice Transcription Integration**: Support for clinical audio recording and auto-filled intake.
- **Configurable Token System**: Global sequential tokens or daily resetting token numbers with timezone alignment.

---

## 📁 Repository Structure

```text
mediassist/
├── index.html                 # Central Launcher & Navigation Hub
├── patient.html               # Patient intake and registration
├── staff.html                 # Staff check-in & token generation desk
├── vital.html                 # Nurse & vitals recording station
├── doctor.html                # Doctor clinical workspace & prescription desk
├── script.js                  # Shared frontend clinic logic & API client
├── style.css                  # Clinical design system & UI styling
├── package.json               # Root dependencies and startup scripts
├── .env.example               # Environment variables template
├── backend/
│   ├── server.js              # Express REST API server
│   ├── supabaseClient.js      # Supabase client singleton
│   ├── daily-token-reset.sql  # Database function & trigger for daily tokens
│   ├── package.json           # Backend package manifest
│   ├── README.md              # Backend-specific documentation
│   └── routes/ & controllers/ # Modular API endpoints & handlers
└── scripts/
    └── dev.js                 # Unified dev runner (frontend + backend)
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v16 or higher recommended)
- **Supabase** account with a configured project

### 2. Installation
Install dependencies in both the root and backend directories:

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 3. Environment Configuration
Copy the sample environment file and add your credentials:

```bash
copy .env.example .env
copy backend\.env.example backend\.env
```

Update `.env` with your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-key
PORT=5000
TOKEN_RESET_MODE=global
DAILY_TOKEN_RESET_OFFSET_MINUTES=330
```

### 4. Running the Application

You can start both the backend API and the frontend development server simultaneously:

```bash
npm run dev
```

The system will start:
- **Backend API**: `http://localhost:5000`
- **Frontend Hub**: `http://localhost:5500`

Direct page shortcuts:
- **Home Launcher**: `http://localhost:5500/`
- **Patient Portal**: `http://localhost:5500/patient.html`
- **Staff Portal**: `http://localhost:5500/staff.html`
- **Vitals Portal**: `http://localhost:5500/vital.html`
- **Doctor Dashboard**: `http://localhost:5500/doctor.html`

---

## 🗄️ Database Setup (Supabase)

If you wish to enable daily token resets (tokens restart from `1` each day):
1. Navigate to the SQL Editor in your Supabase dashboard.
2. Execute the script located at `backend/daily-token-reset.sql`.
3. Set `TOKEN_RESET_MODE=daily` in your `.env`.

---

## 📄 License
This project is licensed under the MIT License.
