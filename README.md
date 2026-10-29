# Advanced Text-to-Speech Web Application

A full-stack starter based on the uploaded project brief: React + TypeScript + Vite, Node.js + Express + TypeScript, PostgreSQL + Prisma, JWT authentication, Google Cloud Text-to-Speech, document extraction (TXT/PDF/DOCX), optional AI text enhancement, speech history, favorites, and admin usage metrics.

## Requirements
- Node.js 20+
- PostgreSQL 15+
- Google Cloud TTS credentials (or configure another provider adapter)

## 1. Configure the backend
```bash
cd server
npm install
copy .env.example .env
```
Edit `server/.env`: set `DATABASE_URL`, a long random `JWT_SECRET`, and Google Cloud credentials. For Google Cloud TTS, either set `GOOGLE_APPLICATION_CREDENTIALS` to the absolute path of your service-account JSON file, or use your deployment platform's workload identity. Never commit secrets.

Create the database in PostgreSQL, for example `tts_app`, then run:
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```
Backend defaults to http://localhost:5000.

## 2. Configure the frontend
In another terminal:
```bash
cd client
npm install
copy .env.example .env
npm run dev
```
Open the Vite URL printed in the terminal (normally http://localhost:5173).

## 3. First admin user
Register a user in the UI. To grant admin access, update that user's `role` in PostgreSQL:
```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your-email@example.com';
```

## API overview
- `GET /api/health` health check
- `POST /api/auth/register` register
- `POST /api/auth/login` login
- `GET /api/tts/voices?language=en-US` list provider voices
- `POST /api/tts` generate audio (authenticated)
- `POST /api/documents/extract` upload and extract TXT/PDF/DOCX text (authenticated)
- `GET /api/history` current user's history (authenticated)
- `PATCH /api/history/:id/favorite` toggle favorite (authenticated)
- `DELETE /api/history/:id` delete history item (authenticated)
- `POST /api/ai/enhance` optional AI rewrite (authenticated; requires OPENAI_API_KEY)
- `GET /api/admin/metrics` admin-only metrics

## Notes and production hardening
- Generated audio is stored locally in `server/audio` for development. For production, implement the cloud-storage adapter in `server/src/services/storage.ts` and use private object storage with signed URLs.
- Google TTS and OpenAI are usage-billed services. Set project budgets and usage quotas before deployment.
- Add email verification, password reset, stricter rate limits, malware scanning for uploads, retention policies, structured logging, and automated tests before production use.
- Uploaded files and generated audio are excluded from Git by `.gitignore`.
- Voice availability depends on the configured TTS provider. Speaking rate and pitch support also depends on provider/voice.
