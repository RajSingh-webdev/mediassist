# MediAssist Backend

This folder now uses the same backend entrypoint as the project root:

- `backend/server.js`
- default port `5000`
- Supabase-backed patient, vitals, and doctor workflow APIs

## Setup

```bash
cd backend
npm install
copy .env.example .env
```

Fill in `.env` with your real Supabase values:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key
PORT=5000
TOKEN_RESET_MODE=global
DAILY_TOKEN_RESET_OFFSET_MINUTES=330
```

## Run

```bash
npm start
```

The backend starts on `http://localhost:5000`.

## Daily Token Reset

If you want daily token numbering instead of globally increasing tokens:

1. Apply `daily-token-reset.sql` to your database.
2. Set `TOKEN_RESET_MODE=daily`.
3. Keep `DAILY_TOKEN_RESET_OFFSET_MINUTES=330` for India time.

## Important

The older prototype backend under `backend/src` is no longer the active app path.
Use `server.js` from either:

```bash
npm start
```

from the project root, or:

```bash
cd backend
npm start
```
