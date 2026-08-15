-- Part 21: Final Production Tables
-- Run this in your Supabase SQL Editor

-- =============================================
-- 1. Study Plan Tasks (for AI Study Schedule)
-- =============================================
CREATE TABLE IF NOT EXISTS public.study_plan_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time_slot TEXT DEFAULT 'morning' CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
    title TEXT NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.study_plan_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own study plan tasks"
    ON public.study_plan_tasks FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 2. Ensure guardian_links has invitation_code col
-- =============================================
ALTER TABLE public.guardian_links 
    ADD COLUMN IF NOT EXISTS invitation_code TEXT,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS guardian_links_invitation_code_unique ON public.guardian_links(invitation_code);

-- =============================================
-- 3. Ensure study_goals has correct columns
-- =============================================
ALTER TABLE public.study_goals
    ADD COLUMN IF NOT EXISTS subjects TEXT[] DEFAULT '{}';

-- =============================================
-- 4. AI Usage Logging (if not exists)
-- =============================================
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'groq',
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all AI usage"
    ON public.ai_usage FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Service role can insert AI usage"
    ON public.ai_usage FOR INSERT WITH CHECK (true);

-- =============================================
-- 5. Ensure manual_payments has plan_id col
-- =============================================
ALTER TABLE public.manual_payments
    ADD COLUMN IF NOT EXISTS plan_id TEXT DEFAULT 'lifetime';

-- =============================================
-- 6. Ensure global_config can be stored in admin_settings
-- =============================================
INSERT INTO public.admin_settings (setting_key, setting_value)
VALUES ('global_config', '{"jamb_date": "2026-04-15T08:00:00"}')
ON CONFLICT (setting_key) DO NOTHING;
