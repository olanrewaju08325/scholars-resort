# Scholars Resort — Complete JAMB UTME CBT & AI Learning Platform

Scholars Resort is a full-featured, AI-powered UTME CBT preparation platform built with React 18, TypeScript, Tailwind CSS, Supabase PostgreSQL, and Vite.

## 🚀 Key Features

- **UTME CBT Exam Simulator**: Realistic JAMB examination environment with timer controls, question palette, flagging, and automated scoring.
- **AI Tutor & Score Predictor**: Algorithmic JAMB score readiness estimation and personalized subject analysis.
- **LaTeX Math & Chemical Expressions**: Embedded KaTeX renderer for science formulas, calculations, and detailed step-by-step explanations.
- **Performance Analytics & Progress Badges**: Interactive charts (Recharts) and milestone badge unlocking system with audio-visual feedback.
- **Guardian & Admin Portals**: Parent monitoring portal, candidate management, content studio, and platform maintenance guard.
- **Offline Safety Engine**: Dexie.js (IndexedDB) session recovery allowing students to resume exams uninterrupted after refreshing or closing their browser.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide Icons, Recharts, KaTeX.
- **Backend & Database**: Supabase (PostgreSQL with RLS, SECURITY DEFINER functions, Triggers, Full-Text Search), Edge Functions.
- **Deployment**: Optimized for Vercel and Cloud Run.

## ⚡ Build & Run Instructions

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Production build
npm run build
```

## 🔺 Vercel Deployment

1. Import your GitHub repository into **Vercel**.
2. Configure Project Settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variables in Vercel Project Settings (e.g., Supabase URL, Anon Key, Groq API Key).
4. Click **Deploy**. Vercel will automatically build and host your full-stack application with optimal performance and server routing.

