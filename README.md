# LearnForge AI

LearnForge AI is a student learning MVP. Students can upload study material, generate a course, ask grounded questions, create multiple-choice quizzes, and review server-scored quiz attempts.

## Features

- Registration, login, logout, and refresh-persistent HTTP-only sessions
- PDF, DOCX, PPT, PPTX, TXT, and CSV uploads with text extraction
- AI-generated courses and topic lessons
- Study assistant with bounded, page-local conversation history
- AI-generated 5, 10, or 15 question quizzes
- Server-side answer validation, scoring, and saved result review
- Ownership checks for documents, courses, quizzes, and results

## Quick start

### Prerequisites

- Node.js 20.9 or newer and npm (Node 22 LTS or newer is recommended; this checkout was verified with Node 24.13.0)
- MongoDB running locally or a MongoDB connection string
- A Gemini API key for course generation, Ask AI, and quiz generation

### Install and configure

```bash
cd backend
npm ci
cd ../frontend
npm ci
```

Copy `backend/.env.example` to `backend/.env`, and `frontend/.env.example` to `frontend/.env.local`. Set `AUTH_SECRET` to a private random value of at least 32 characters. One way to generate it is:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Start MongoDB, then set the backend `MONGODB_URI`. Configure `AI_PROVIDER=gemini` and `GEMINI_API_KEY` in `backend/.env`. The frontend API URL defaults to the local backend. See [Environment variables](#environment-variables) for details. Never put the Gemini key in a frontend variable. Gemini availability, limits, and pricing depend on Google's current terms; a free tier is not guaranteed.

### Run

In separate terminals:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The API defaults to port 4000; check [http://localhost:4000/api/health](http://localhost:4000/api/health).

## Architecture

```text
Browser
   ↓
Next.js frontend
   ↓ REST (HTTP-only session cookie)
Express API
   ↓
Services ── Authentication
   ├──────── Documents
   ├──────── Courses
   ├──────── AI
   └──────── Quizzes
       ↓
MongoDB / Mongoose

AI Service → AIProvider → Gemini (LangChain)

Upload → Text Extraction → Document.extractedText → Course Generation
Course → Quiz Generation → Quiz → Server-side Scoring → QuizResult
```

The frontend calls the backend through REST using `NEXT_PUBLIC_API_URL`. Credentialed CORS is restricted to `FRONTEND_URL`. The Gemini credential is backend-only. AI feature services depend on `AIService`/`AIProvider`, not the Gemini implementation.

### Technology stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: MongoDB and Mongoose
- AI: LangChain with Gemini as the current provider
- Backend tests: Vitest and Supertest

### Repository structure

```text
frontend/                 Next.js application
  src/app/                Pages and route UI
  src/lib/                API client, auth, and feature API helpers
backend/                  Express API
  src/config/             Environment and MongoDB setup
  src/middleware/         Authentication middleware
  src/models/             Mongoose models
  src/routes/             REST endpoints and API tests
  src/services/           AI, courses, documents, quizzes, storage
README.md                 Setup and developer guide
```

## Environment variables

The checked-in `.env.example` files contain placeholders/defaults only. The backend requires `MONGODB_URI`, `AUTH_SECRET` (at least 32 characters), and `GEMINI_API_KEY` when `AI_PROVIDER=gemini`. Defaults are for local development. The frontend needs no secret; it exposes only the API base URL.

Backend (`backend/.env.example`):

| Variable | Required | Purpose / local default |
| --- | --- | --- |
| `PORT` | Production | API port; `4000` locally |
| `NODE_ENV` | Production | Runtime mode; set `production` on the host, `development` locally |
| `FRONTEND_URL` | Production | Allowed credentialed CORS origin; `http://localhost:3000` locally |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `AUTH_SECRET` | Yes | Private JWT signing secret, minimum 32 characters |
| `AUTH_COOKIE_NAME` | No | Session cookie name; `learnforge_session` |
| `AUTH_COOKIE_SECURE` | No | `false` for local HTTP; production always uses secure cookies |
| `AUTH_TOKEN_TTL` | No | Session lifetime; `7d` |
| `DOCUMENT_UPLOAD_DIR` | Production | Upload storage path; `uploads` locally; use a persistent mount in production |
| `AI_PROVIDER` | Production | Provider selector; `gemini` is currently supported |
| `GEMINI_API_KEY` | Production | Server-side Gemini key; never expose to the browser |
| `GEMINI_MODEL` | Production | Model setting; `gemini-3.8-flash` locally |
| `AI_MAX_CONTEXT_CHARS` | No | Maximum combined model input; `100000` |
| `AI_REQUEST_TIMEOUT_MS` | No | Provider request timeout; `30000` |
| `AI_MAX_HISTORY_MESSAGES` | No | Recent Ask AI messages accepted; `12` |

Frontend (`frontend/.env.example`):

| Variable | Required | Purpose / local default |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Production | REST API base URL; `http://localhost:4000/api` locally |

`FRONTEND_URL` is the actual backend variable name used for credentialed CORS (sometimes called `CLIENT_URL` in deployment instructions). It must be the frontend origin only, with no path or trailing slash. `NEXT_PUBLIC_API_URL` is public configuration and must contain the backend API base URL, including `/api`.

Set production origins and database URLs for the target host. Production startup requires explicit `PORT`, `MONGODB_URI`, `FRONTEND_URL`, `AUTH_SECRET`, `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and `DOCUMENT_UPLOAD_DIR` values; local defaults are not accepted for those settings. Production MongoDB must not point to loopback. `AUTH_COOKIE_SECURE` is always enabled when `NODE_ENV=production`. The backend reports missing variable names without printing secret values.

## Development commands

Run from each package directory.

Backend:

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm start
npm run ai:check # optional live Gemini connectivity check; requires a real key
```

Frontend:

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm start
```

Backend tests use mocked models/provider behavior and do not call Gemini or write to a developer database. No separate test MongoDB is required for the current suite. There is no frontend unit or browser-driven E2E framework configured. No seed data is created; the live application can be demonstrated by registering a user and uploading material.

## Deployment

**Deployment status: not deployed.** No hosting platform or production origins have been selected yet.

- Frontend URL: **not assigned**
- Backend API URL: **not assigned**

Set both URLs in the environment after the hosting target assigns them; no example production domains are provided. The app is prepared for a standard Node.js backend and Next.js frontend and has no provider-specific deployment manifests.

Before deploying, arrange:

1. A hosted MongoDB database and a restricted application database user.
2. A Gemini API key with quota appropriate for the demo/use case.
3. A Node.js host for the backend and a Next.js-compatible frontend host.
4. Persistent writable disk for backend uploads; set `DOCUMENT_UPLOAD_DIR` to that mounted path.

### Backend

From `backend/`, configure the production environment listed above, set `NODE_ENV=production`, then run:

```bash
npm ci
npm run build
npm start
```

The API listens on `PORT` and binds through Node's default all-interface host behavior. Configure `MONGODB_URI` with the hosted database URI. Set `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, and `GEMINI_MODEL`; the key stays on the backend. Set `FRONTEND_URL` to the exact deployed frontend origin. Credentialed CORS uses that origin without a wildcard, and unsafe browser requests with a different `Origin` are rejected. The API also sends basic content-type, framing, referrer, and permissions policy headers. `/api/health` is suitable for platform health checks.

### Frontend

Set `NEXT_PUBLIC_API_URL` to the deployed backend API base URL (including `/api`) **before building**, then run from `frontend/`:

```bash
npm ci
npm run build
npm start
```

The browser makes credentialed requests to that URL. With the current `SameSite=Lax` session cookie, deploy frontend and backend on HTTPS origins that are same-site (for example, subdomains of one site); CORS still requires the exact frontend origin. The session cookie is HTTP-only, host-only, secure in production, and scoped to `/`. Local HTTP development retains `SameSite=Lax` without the `Secure` flag.

### Local and production configuration

| Setting | Development | Production |
| --- | --- | --- |
| Frontend | `http://localhost:3000` | Deployed HTTPS frontend origin |
| Backend | `http://localhost:4000` | Deployed API URL, with host-provided `PORT` |
| MongoDB | Local or hosted URI | Hosted database URI in backend environment |
| Gemini | Backend `.env` key | Backend host secret/configuration only |
| Upload files | `backend/uploads/` by default | Persistent writable disk at `DOCUMENT_UPLOAD_DIR` |

The backend stores the **original uploaded files persistently on local disk** and stores extracted text and metadata in MongoDB. It does not remove the original after extraction. On an ephemeral filesystem, originals can disappear on restart/redeploy while database records remain; use persistent disk and a single backend instance for this MVP. Cloud/object storage and multi-instance shared file storage are not implemented.

### Deployment checklist

- [ ] MongoDB production database created
- [ ] Backend environment variables configured
- [ ] Gemini API key configured
- [ ] Persistent upload disk configured
- [ ] Backend deployed
- [ ] `/api/health` works
- [ ] Frontend API URL configured before build
- [ ] Frontend deployed
- [ ] CORS configured for the exact frontend origin
- [ ] Registration works
- [ ] Login works
- [ ] Upload works
- [ ] Course generation works
- [ ] Ask AI works
- [ ] Quiz generation works
- [ ] Quiz submission works
- [ ] Quiz results work
- [ ] Cross-user authorization tested
- [ ] No secrets committed

Gemini availability, quotas, and pricing depend on Google's current terms; no provider guarantees unlimited or permanently free usage.

### Production smoke test

After both services are deployed and configured, run this against the real frontend and backend:

1. Open the frontend URL, register a new user, log in, and open the dashboard.
2. Upload a small PDF, generate a course, open the course, and open a topic.
3. Ask AI a question and then a follow-up question.
4. Generate a 5-question quiz, complete it, and submit it.
5. Confirm the score is returned by the backend, review answers, and log out.
6. Log in again and confirm the course remains available.
7. Using a second account, verify the first user's document, course, quiz, and quiz result are inaccessible.
8. Inspect the quiz-taking API response before submission and confirm it contains no correct answers or explanations.
9. Confirm the Gemini key is present only in backend configuration and errors expose no secrets or stack traces.

Do not mark these checks complete until they have been performed against the deployed services.

## API overview

All routes are prefixed with `/api`. Except registration/login/logout and health, endpoints require the HTTP-only session cookie. Request failures use a JSON `{ "message": "..." }` response. User and resource ownership come from the authenticated session.

| Area / endpoint | Request | Response and validation |
| --- | --- | --- |
| `POST /auth/register` | JSON `{ name, email, password }` | Creates account and session; validates name, email, password; duplicate email is rejected. |
| `POST /auth/login` | JSON `{ email, password }` | Starts session; invalid credentials return a generic message. |
| `POST /auth/logout` | No body | Clears the session cookie. |
| `GET /auth/me` | — | Current public user only; invalid session is rejected. |
| `POST /documents/upload` | Multipart field `file` | Extracts supported PDF/DOCX/PPT/PPTX/TXT/CSV text and returns metadata; max 10 MB; type/content validated. |
| `GET /documents` | — | Lists only the current user's document metadata. |
| `GET /documents/:id` | — | Returns owned document metadata; extracted text is not returned. |
| `DELETE /documents/:id` | — | Deletes owned metadata and local stored file. |
| `POST /courses/generate` | JSON `{ documentId }` | Generates or returns the existing course from an owned document with extracted text. |
| `GET /courses` | — | Lists only the current user's courses. |
| `GET /courses/:id` | — | Returns one owned course and topics. |
| `POST /ai/ask` | JSON `{ courseId, question, history? }` | Returns a grounded answer; history roles/content and input size are bounded. |
| `POST /quizzes/generate` | JSON `{ courseId, questionCount }` | Generates and saves a quiz; count must be 5, 10, or 15. Returns metadata without answers. |
| `GET /quizzes/:id` | — | Returns owned quiz questions/options only; correct answers and explanations are omitted. |
| `POST /quizzes/:id/submit` | JSON `{ answers: [{ questionId, selectedAnswer }] }` | Requires one valid answer per question; server calculates score and persists a result. Client score/correctness fields are rejected. |
| `GET /quizzes/results/:resultId` | — | Returns the owner's score and post-submission answer review, including correct answers and explanations. |
| `GET /health` | — | Public process health status; exposes no configuration or secrets. |

## Manual smoke-test checklist

Use a fresh account and a small text-rich sample document. Test every supported format periodically; PDF and DOCX are sufficient for the routine manual pass.

- [ ] Register
- [ ] Login
- [ ] Logout
- [ ] Upload PDF
- [ ] Upload DOCX
- [ ] Upload unsupported file
- [ ] Generate course
- [ ] Open course
- [ ] Open topic
- [ ] Ask AI
- [ ] Ask follow-up question
- [ ] Generate 5-question quiz
- [ ] Take quiz
- [ ] Submit quiz
- [ ] View score
- [ ] Review answers
- [ ] Try again
- [ ] Verify unauthorized access is blocked

## Architecture decisions

- **Next.js:** provides the React UI and routes in one frontend project.
- **Express:** keeps REST APIs and server-only operations separate from browser code.
- **MongoDB/Mongoose:** stores user-owned documents, extracted text, courses, quizzes, and results with straightforward document schemas.
- **LangChain:** supplies the Gemini model integration; the app uses it at the provider boundary rather than adding agents or chains.
- **Gemini:** the initial configurable provider for structured generation and grounded answers.
- **`AIProvider` abstraction:** lets feature services use application operations and allows a future provider implementation without changing those services.
- **No vector database:** this MVP sends the full extracted text within a configured size limit; retrieval is not needed for the current scope.
- **Server-side quiz scoring:** keeps correct answers and authoritative scores under backend control.
- **Stored extracted text:** avoids reparsing each document for course, assistant, and quiz requests.

## Known limitations

- Scanned PDFs are rejected; OCR is not included.
- Complete extracted text is sent up to `AI_MAX_CONTEXT_CHARS`; there is no chunk retrieval or RAG.
- Ask AI history is held in frontend memory and is not persisted.
- Quiz attempts are saved, but there is no history dashboard or advanced attempt management.
- Local file storage is intended for development and a single-server MVP; cloud storage is not configured.
- The backend has automated unit/API tests; the whole live flow requires reachable MongoDB and a configured Gemini key. No browser E2E suite is configured.
