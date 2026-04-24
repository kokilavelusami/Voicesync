# 🎙️ VoiceSync

> Transform text into natural-sounding speech with a hybrid AI engine — premium ElevenLabs voices with automatic Web Speech API fallback.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ Features

- 🎚️ **Hybrid TTS engine** — Toggle between premium AI voices (ElevenLabs) and instant browser voices (Web Speech API)
- 🛡️ **Automatic fallback** — If the premium engine is offline or out of quota, the app gracefully degrades to browser TTS so it never breaks
- 🔐 **Authentication** — Email/password + Google OAuth, with protected routes
- 🗂️ **History** — Every premium clip is saved per-user with row-level security
- 🔊 **11 voices** with multiple accents (American, British, Australian, Swedish)
- ⚡ **Adjustable playback speed** (0.5x – 2x)
- 📥 **Download MP3** of premium clips
- 🌊 **Animated waveform visualizer** while playing
- 🌓 **Dark, glassmorphic UI** with semantic design tokens

---

## 🏗️ Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Routing / State | React Router, TanStack Query |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions on Deno) |
| Premium TTS | [ElevenLabs API](https://elevenlabs.io) (`eleven_turbo_v2_5`) |
| Fallback TTS | Browser-native Web Speech API |
| Testing | Vitest |

---

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh) (or Node 18+ with npm)
- A [Supabase](https://supabase.com) project
- (Optional) An [ElevenLabs](https://elevenlabs.io) API key for premium voices

### 1. Clone & install
```bash
git clone https://github.com/YOUR-USERNAME/voicesync.git
cd voicesync
bun install
```

### 2. Configure environment
Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
VITE_SUPABASE_PROJECT_ID="your-project-id"
```

### 3. Set up the database
Apply the migrations in `supabase/migrations/` to your Supabase project. They create:
- `profiles` table (user metadata)
- `generations` table (history of premium TTS clips)
- `voice-audio` storage bucket (private, RLS-protected)
- Row-level security policies on all tables

### 4. Configure backend secrets
In your Supabase project → **Edge Functions → Secrets**, add:

| Secret | Required | Purpose |
|---|---|---|
| `ELEVENLABS_API_KEY` | Optional | Enables the premium voice engine. Without it the app still works via browser TTS. |
| `SUPABASE_URL` | Auto | Provided by Supabase |
| `SUPABASE_ANON_KEY` | Auto | Provided by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Provided by Supabase |

### 5. Deploy the edge function
```bash
supabase functions deploy text-to-speech
```

### 6. Run the app
```bash
bun run dev
```
Open [http://localhost:5173](http://localhost:5173).

---

## 🧠 How It Works

```
User types text
     │
     ▼
┌─────────────────┐
│  Engine toggle  │
└────────┬────────┘
         │
   ┌─────┴──────┐
   ▼            ▼
Browser    ElevenLabs (Edge Function)
(instant)       │
                ├─ ✅ success → upload to Storage → save to DB → signed URL
                └─ ❌ fail/quota → graceful fallback to Browser TTS
```

The hybrid design guarantees the app **never shows a dead end** — even if the premium API is down or out of credits, users still get audio output.

---

## 📁 Project Structure

```
src/
├── components/
│   ├── VoiceSync.tsx          # Main TTS interface
│   ├── WaveformVisualizer.tsx # Animated playback indicator
│   ├── Header.tsx             # Nav with auth state
│   └── ProtectedRoute.tsx     # Auth guard
├── lib/
│   ├── browserTTS.ts          # Web Speech API wrapper
│   └── voices.ts              # Voice catalog
├── pages/
│   ├── Index.tsx              # Home / generator
│   ├── Auth.tsx               # Sign in / sign up
│   └── History.tsx            # Past generations
└── hooks/useAuth.tsx          # Auth context

supabase/
├── functions/text-to-speech/  # Deno edge function (ElevenLabs proxy)
└── migrations/                # SQL schema + RLS policies
```

---

## 🔒 Security

- All tables protected by **Row-Level Security** — users can only read/write their own data
- Audio files stored in a **private bucket** with short-lived signed URLs (24h)
- ElevenLabs API key never exposed to the client — proxied through an authenticated edge function
- JWT validation enforced inside the edge function

---

## 🧪 Testing

```bash
bun run test
```

---

## 📜 License

MIT — see [LICENSE](LICENSE)

---

## 🙋 Author

Built by **[Your Name]** — [LinkedIn](https://linkedin.com/in/your-handle) · [Portfolio](https://your-site.com)

> Live demo: [voicesync.lovable.app](https://voicesync.lovable.app)
