-- Part 24: Enterprise Platform Schema
-- Run this in your Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════════
-- 1. STUDY LOGS TABLE (for Heatmap)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.study_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL DEFAULT 'session', -- 'session', 'practice', 'exam', 'flashcard'
    duration_minutes INTEGER DEFAULT 0,
    subject TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.study_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own study logs" ON public.study_logs;

CREATE POLICY "Users can manage own study logs"
    ON public.study_logs FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_study_logs_user_date 
    ON public.study_logs(user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- 2. FIX STUDY_GOALS TABLE (ensure correct columns)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.study_goals 
    ADD COLUMN IF NOT EXISTS target_score INTEGER DEFAULT 300,
    ADD COLUMN IF NOT EXISTS exam_date DATE,
    ADD COLUMN IF NOT EXISTS daily_study_hours NUMERIC(5,2) DEFAULT 2,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now());

-- Ensure user_id is UNIQUE for upsert to work
ALTER TABLE public.study_goals 
    DROP CONSTRAINT IF EXISTS study_goals_user_id_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'study_goals_user_id_key'
    ) THEN
        ALTER TABLE public.study_goals ADD CONSTRAINT study_goals_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. PRACTICE SESSIONS TABLE
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id),
    score INTEGER,
    total_questions INTEGER,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own practice sessions" ON public.practice_sessions;

CREATE POLICY "Users manage own practice sessions"
    ON public.practice_sessions FOR ALL
    USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 4. SESSION ANSWERS TABLE
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.session_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    practice_session_id UUID REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
    exam_session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_answer TEXT,
    is_correct BOOLEAN DEFAULT false,
    time_spent_secs INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.session_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own session answers" ON public.session_answers;

CREATE POLICY "Users manage own session answers"
    ON public.session_answers FOR ALL
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_session_answers_user 
    ON public.session_answers(user_id, is_correct, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- 5. STUDY PLAN TASKS TABLE
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.study_plan_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time_slot TEXT DEFAULT 'morning', -- morning, afternoon, evening
    title TEXT NOT NULL,
    subject_id UUID REFERENCES public.subjects(id),
    topic_id UUID REFERENCES public.topics(id),
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.study_plan_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own study plan tasks" ON public.study_plan_tasks;

CREATE POLICY "Users manage own study plan tasks"
    ON public.study_plan_tasks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_study_plan_tasks_user_date
    ON public.study_plan_tasks(user_id, date DESC);

-- ═══════════════════════════════════════════════════════════════════
-- 6. COMMUNICATION LOGS TABLE  
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT,
    email_type TEXT NOT NULL,
    subject TEXT,
    status TEXT DEFAULT 'delivered',
    sent_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read communication logs" ON public.communication_logs;

CREATE POLICY "Admins can read communication logs"
    ON public.communication_logs FOR SELECT
    USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- 7. AI USAGE TRACKING TABLE
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    feature TEXT NOT NULL,
    provider TEXT DEFAULT 'groq', -- 'groq' | 'claude'
    total_tokens INTEGER DEFAULT 0,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read ai usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Service role can insert ai usage" ON public.ai_usage;

CREATE POLICY "Admins can read ai usage"
    ON public.ai_usage FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Service role can insert ai usage"
    ON public.ai_usage FOR INSERT
    WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- 8. BOOKMARKS TABLE
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    UNIQUE(user_id, question_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own bookmarks" ON public.bookmarks;

CREATE POLICY "Users manage own bookmarks"
    ON public.bookmarks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 9. QUESTION HISTORY TABLE (for admin version control)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.question_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    previous_data JSONB,
    change_reason TEXT,
    version_number INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.question_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage question history" ON public.question_history;

CREATE POLICY "Admins manage question history"
    ON public.question_history FOR ALL
    USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- 10. ADD MISSING COLUMNS TO QUESTIONS TABLE
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS quality_score INTEGER,
    ADD COLUMN IF NOT EXISTS quality_flags JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS year INTEGER;

-- ═══════════════════════════════════════════════════════════════════
-- 11. ADD MISSING COLUMNS TO PROFILES TABLE
-- ═══════════════════════════════════════════════════════════════════
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'xp') THEN
        ALTER TABLE public.profiles ADD COLUMN xp INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'level') THEN
        ALTER TABLE public.profiles ADD COLUMN level INTEGER DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'phone') THEN
        ALTER TABLE public.profiles ADD COLUMN phone TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'state') THEN
        ALTER TABLE public.profiles ADD COLUMN state TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'intended_course') THEN
        ALTER TABLE public.profiles ADD COLUMN intended_course TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'intended_university') THEN
        ALTER TABLE public.profiles ADD COLUMN intended_university TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'jamb_year') THEN
        ALTER TABLE public.profiles ADD COLUMN jamb_year INTEGER;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 12. DEVICE SESSIONS TABLE (for admin live user count)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.device_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_seen TIMESTAMPTZ DEFAULT timezone('utc', now()),
    device_type TEXT DEFAULT 'web', -- 'web', 'mobile'
    UNIQUE(user_id)
);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can upsert own device session" ON public.device_sessions;
DROP POLICY IF EXISTS "Admins can read device sessions" ON public.device_sessions;

CREATE POLICY "Users can upsert own device session"
    ON public.device_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read device sessions"
    ON public.device_sessions FOR SELECT
    USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- 13. ADMIN AI PROMPTS TABLE (for AI Prompt Studio) - FIXED
-- ═══════════════════════════════════════════════════════════════════
-- Check if table exists with different column names and handle accordingly
DO $$
BEGIN
    -- Drop existing table if it exists with old structure
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'admin_ai_prompts') THEN
        DROP TABLE public.admin_ai_prompts CASCADE;
    END IF;
END $$;

CREATE TABLE public.admin_ai_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name TEXT NOT NULL UNIQUE,
    system_prompt TEXT NOT NULL,
    model TEXT DEFAULT 'llama-3.3-70b-versatile',
    temperature FLOAT DEFAULT 0.7,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.admin_ai_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage AI prompts" ON public.admin_ai_prompts;

CREATE POLICY "Admins manage AI prompts"
    ON public.admin_ai_prompts FOR ALL
    USING (public.is_admin());

-- Seed default prompts
INSERT INTO public.admin_ai_prompts (feature_name, system_prompt, model, temperature) VALUES
  ('explain', 'You are a helpful JAMB AI tutor. Explain concepts clearly and concisely in simple English suitable for Nigerian secondary school students.', 'llama-3.3-70b-versatile', 0.5),
  ('generate_question', 'You are an expert JAMB question setter. Generate high-quality, unambiguous multiple-choice questions following JAMB standards and format strictly as JSON.', 'llama-3.3-70b-versatile', 0.8),
  ('study_planner', 'You are an expert academic advisor specializing in JAMB exam preparation. Create personalized, realistic, and actionable study plans.', 'claude-3-5-sonnet-20241022', 0.6),
  ('admin_assistant', 'You are the AI OS assistant for Scholars Resort administration platform. You help admins analyze data, draft communications, and make decisions. Be professional, structured, and concise.', 'claude-3-5-sonnet-20241022', 0.7),
  ('flashcards', 'You are a JAMB flashcard generator. Create clear, memorable flashcards that help students quickly master key concepts.', 'llama-3.3-70b-versatile', 0.7),
  ('quiz', 'You are a JAMB quiz generator. Create challenging, high-quality quiz packs with detailed explanations.', 'llama-3.3-70b-versatile', 0.8)
ON CONFLICT (feature_name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 14. ADMIN SETTINGS TABLE
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Students can read feature toggles" ON public.admin_settings;

CREATE POLICY "Admins manage settings"
    ON public.admin_settings FOR ALL
    USING (public.is_admin());

CREATE POLICY "Students can read feature toggles"
    ON public.admin_settings FOR SELECT
    USING (setting_key = 'feature_toggles');

-- Seed default settings
INSERT INTO public.admin_settings (setting_key, setting_value) VALUES
  ('feature_toggles', '{"cbt_enabled": true, "tournaments_enabled": true, "ai_enabled": true, "guardian_enabled": true}'),
  ('platform_settings', '{"platform_name": "Scholars Resort", "support_email": "support@scholarsresort.com", "max_free_exams": 3}')
ON CONFLICT (setting_key) DO NOTHING;

-- Force cache reload
NOTIFY pgrst, 'reload schema';