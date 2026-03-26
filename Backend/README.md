# Backend Setup for 3D-Model-Web

This project is configured with **Express**, **TypeScript**, **Prisma ORM**, and **PostgreSQL**.
Everything is pre-configured to run as containers via **Docker Compose**.

## Prerequisites
- Node.js (v20+ recommended)
- Docker & Docker Compose

## Quick Start (Docker)

To run both the PostgreSQL database and the API backend simultaneously using Docker Compose:

1. Open a terminal in the `Backend` directory.
2. Run the following command:
   ```bash
   docker-compose up -d --build
   ```
3. Docker will build the API image, start the PostgreSQL container, wait for it to be healthy, and then start the API server.
4. You can see the logs using:
   ```bash
   docker-compose logs -f api
   ```
5. The API server will be available at: **http://localhost:3000/health**

## Local Development (Without Docker for API)

If you prefer to run the Node app locally while the database runs on Docker:

1. Start only the PostgreSQL database using Docker Compose:
   ```bash
   docker-compose up -d db
   ```
2. Install local dependencies:
   ```bash
   npm install
   ```
3. Generate the Prisma Client and migrate the local database:
   ```bash
   npx prisma generate
   npm run db:migrate
   ```
4. Start the development server (runs with nodemon):
   ```bash
   npm run dev
   ```
5. The server will be available at: **http://localhost:3000/health**

## Adding More Models

1. Add your models to `prisma/schema.prisma`.
2. Generate the Prisma Client: `npx prisma generate`.
3. Create a migration and execute it: `npm run db:migrate`.
4. Import and use the model in your `src` files.

## Edge-TTS Character Speak API

Endpoint:

```http
POST /api/v1/character/speak
```

Request body:

```json
{
   "characterId": "default-character",
   "text": "Xin chao, toi la VTuber cua ban",
   "language": "vi"
}
```

Response (JSON with base64 audio):

```json
{
   "characterId": "default-character",
   "language": "vi",
   "voiceConfig": {
      "provider": "edge-tts",
      "voiceName": "vi-VN-HoaiMyNeural",
      "pitch": 1,
      "speed": 1
   },
   "audio": {
      "mimeType": "audio/mpeg",
      "base64": "...",
      "streamUrl": null
   },
   "mouthOpenTimeline": [
      { "timeMs": 0, "mouthOpen": 0.85 }
   ]
}
```

If `characterId` is not found in `CharacterConfig`, the API still synthesizes speech by using:

- `provider`: `edge-tts`
- `voiceName`: `DEFAULT_VOICE_VN` or `DEFAULT_VOICE_EN`
- `pitch`: `1`
- `speed`: `1`

Environment variables:

```env
DEFAULT_VOICE_VN=vi-VN-HoaiMyNeural
DEFAULT_VOICE_EN=en-US-GuyNeural
```

### Quick test with Postman

1. Method: `POST`
2. URL: `http://localhost:3000/api/v1/character/speak`
3. Header: `Content-Type: application/json`
4. Body (raw JSON):

```json
{
   "characterId": "default-character",
   "text": "Hello from Edge TTS",
   "language": "en"
}
```

5. Send request and check `audio.base64` in the response.

### Quick test in browser console

```js
fetch('http://localhost:3000/api/v1/character/speak', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
      characterId: 'default-character',
      text: 'Xin chao VTuber',
      language: 'vi'
   })
}).then(r => r.json()).then(console.log);
```

## VRM Upload API

Endpoint:

```http
POST /api/v1/models/vrm/upload
```

Request format: `multipart/form-data`

- Field name: `file`
- File type: `.vrm`
- Max size: `50MB`

Response example:

```json
{
   "message": "VRM file uploaded successfully",
   "file": {
      "originalName": "avatar.vrm",
      "fileName": "1711440000000-avatar.vrm",
      "size": 1234567,
      "mimeType": "application/octet-stream",
      "url": "/uploads/vrm/1711440000000-avatar.vrm"
   }
}
```

After upload, the model can be loaded via:

```text
http://localhost:3000/uploads/vrm/<fileName>
```

## Deploy to Render (Docker + Prisma + PostgreSQL)

This repository now includes a Render Blueprint at `render.yaml` in the repository root.

### What the Blueprint creates

1. A PostgreSQL database service on Render.
2. A Docker-based Web Service for this Backend.
3. Automatic `DATABASE_URL` wiring from Render PostgreSQL to the Backend service.
4. Required runtime environment values for Edge-TTS and API port.

### Files used

1. `render.yaml` (at repo root): Render Blueprints definition.
2. `Backend/Dockerfile`: optimized multi-stage Alpine build with Prisma generate.
3. `Backend/.dockerignore`: smaller Docker build context for lower memory usage.

### Important package scripts

```json
{
   "start": "node dist/index.js",
   "build": "npx tsc",
   "prisma:generate": "npx prisma generate",
   "db:migrate:deploy": "npx prisma migrate deploy"
}
```

### Environment variables on Render

1. `DATABASE_URL` (auto-linked from Render database).
2. `PORT` (set to `10000`, Render-compatible).
3. `DEFAULT_VOICE_VN` (e.g. `vi-VN-HoaiMyNeural`).
4. `DEFAULT_VOICE_EN` (e.g. `en-US-GuyNeural`).
5. `TTS_MOCK_MODE` (`false` for real TTS).

### One-click-ish deployment flow

1. Push all code (including `render.yaml`) to GitHub.
2. In Render Dashboard, click `New` -> `Blueprint`.
3. Connect your GitHub repository.
4. Render detects `render.yaml` and shows resources to create.
5. Click `Apply`.
6. Wait for initial build/deploy; health check is `GET /health`.

The container startup command runs `prisma migrate deploy` before launching the API, so Prisma schema changes are applied safely in production.
