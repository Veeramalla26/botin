# Interview Bot

AI-powered interview assistant with voice detection — built like the reference app using **React**, **Firebase Firestore**, **Firebase Auth**, and **Vercel serverless API**.

## Stack (matches reference app)

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite, deployed on **Vercel** |
| Database | **Firebase Firestore** (real-time sync) |
| Auth | **Firebase Authentication** (email/password) |
| AI | **Vercel `/api/chat`** serverless function + OpenAI |
| Voice | Web Speech API (browser) |

OpenAI key lives on the **server only** — end users don't need their own key.

## Features

- Voice auto-detection → transcribes questions → auto-generates responses
- Response modes: Send, Elaborate, Brief, Resume, System Design, Code, Fixed Question
- Real-time response sync via Firestore
- Notes auto-save
- Firebase login (sign up / sign in)

---

## Setup (one-time)

### 1. Create Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. **Create a project** (e.g. `interview-bot`)
3. Enable **Authentication** → Sign-in method → **Email/Password** → Enable
4. Enable **Firestore Database** → Create database → Start in **test mode** (we'll add rules)
5. Go to **Project Settings** → **Your apps** → Add **Web app**
6. Copy the `firebaseConfig` values

### 2. Configure environment files

**Root `.env`** (for local API server):
```bash
cp .env.example .env
# Add your OpenAI API key (server-side only)
```

**Frontend `.env`**:
```bash
cp frontend/.env.example frontend/.env
# Paste Firebase config values (VITE_ prefix vars)
```

### 3. Deploy Firestore security rules

In Firebase Console → Firestore → **Rules**, paste contents of `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**.

### 4. Install dependencies

```bash
npm run install-all
```

### 5. Run locally

```bash
npm run dev
```

- Frontend: **http://localhost:3000**
- Local API: **http://localhost:3001/api/chat**

Open in **Chrome or Edge** for voice detection.

---

## Deploy to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project
3. Add **Environment Variables** in Vercel dashboard:

| Variable | Where | Value |
|----------|-------|-------|
| `OPENAI_API_KEY` | Server | Your OpenAI key |
| `OPENAI_MODEL` | Server | `gpt-4o-mini` |
| `VITE_FIREBASE_API_KEY` | Client | From Firebase config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Client | From Firebase config |
| `VITE_FIREBASE_PROJECT_ID` | Client | From Firebase config |
| `VITE_FIREBASE_STORAGE_BUCKET` | Client | From Firebase config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Client | From Firebase config |
| `VITE_FIREBASE_APP_ID` | Client | From Firebase config |

4. Deploy — Vercel builds frontend + `/api/chat` automatically

---

## Usage

1. **Sign up** with email/password
2. Enter company name → **Join Session**
3. Click **Voice Off** to enable microphone listening
4. Speak an interview question → pause 2 sec → response appears
5. Use mode buttons for specialized answers
6. Copy, save to notes, or regenerate responses

---

## Project structure

```
interviewprompt/
├── api/
│   ├── chat.js          ← Vercel serverless (OpenAI)
│   └── lib/prompts.js
├── frontend/
│   └── src/
│       ├── firebase.js
│       ├── services/firestore.js
│       └── App.jsx
├── scripts/dev-api.js   ← Local dev API server
├── firestore.rules
├── vercel.json
└── package.json
```

## Cost

- **Firebase**: Free tier covers personal use (Firestore + Auth)
- **Vercel**: Free tier for hobby projects
- **OpenAI**: ~$0.001–0.005 per response with `gpt-4o-mini` (~$5 lasts hundreds of sessions)

---

## Legacy MySQL backend

The old `backend/` folder (Express + MySQL) is no longer used. You can delete it if you don't need it.
