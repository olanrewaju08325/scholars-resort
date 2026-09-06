-- ==============================================================================
-- Migration: 0044_ensure_weekly_challenges_and_study_logs.sql
-- Description:
-- 1. Ensure public.study_logs has all potential columns (action_type, action, subject_context, is_utme_curriculum, subject, duration_minutes)
-- 2. Ensure public.weekly_challenges table exists with proper RLS policies
-- 3. Ensure public.weekly_challenge_submissions table exists with proper RLS policies
-- 4. Reload PostgREST schema cache
-- ==============================================================================

-- 1. FIX STUDY_LOGS TABLE COLUMNS
CREATE TABLE IF NOT EXISTS public.study_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type VARCHAR(50) DEFAULT 'practice',
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.study_logs
  ADD COLUMN IF NOT EXISTS action_type VARCHAR(50) DEFAULT 'practice',
  ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'practice',
  ADD COLUMN IF NOT EXISTS subject_context TEXT,
  ADD COLUMN IF NOT EXISTS is_utme_curriculum BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 0;

ALTER TABLE public.study_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_logs_select_policy" ON public.study_logs;
CREATE POLICY "study_logs_select_policy" ON public.study_logs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_logs_insert_policy" ON public.study_logs;
CREATE POLICY "study_logs_insert_policy" ON public.study_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_logs_update_policy" ON public.study_logs;
CREATE POLICY "study_logs_update_policy" ON public.study_logs FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_logs_delete_policy" ON public.study_logs;
CREATE POLICY "study_logs_delete_policy" ON public.study_logs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_study_logs_user_date ON public.study_logs(user_id, created_at DESC);


-- 2. ENSURE WEEKLY_CHALLENGES TABLE EXISTS
CREATE TABLE IF NOT EXISTS public.weekly_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    question_data JSONB NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active weekly challenges" ON public.weekly_challenges;
CREATE POLICY "Anyone can view active weekly challenges" ON public.weekly_challenges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage weekly challenges" ON public.weekly_challenges;
CREATE POLICY "Admins can manage weekly challenges" ON public.weekly_challenges FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);


-- 3. ENSURE WEEKLY_CHALLENGE_SUBMISSIONS TABLE EXISTS
CREATE TABLE IF NOT EXISTS public.weekly_challenge_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID REFERENCES public.weekly_challenges(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    selected_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(challenge_id, user_id)
);

ALTER TABLE public.weekly_challenge_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view challenge submissions" ON public.weekly_challenge_submissions;
DROP POLICY IF EXISTS "Users can view submissions" ON public.weekly_challenge_submissions;
CREATE POLICY "Anyone can view challenge submissions" ON public.weekly_challenge_submissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own challenge submissions" ON public.weekly_challenge_submissions;
DROP POLICY IF EXISTS "Users manage own challenge submissions" ON public.weekly_challenge_submissions;
CREATE POLICY "Users can insert own challenge submissions" ON public.weekly_challenge_submissions FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users can update own challenge submissions" ON public.weekly_challenge_submissions;
CREATE POLICY "Users can update own challenge submissions" ON public.weekly_challenge_submissions FOR UPDATE USING (
  auth.uid() = user_id
);

CREATE INDEX IF NOT EXISTS idx_weekly_challenge_submissions_cid ON public.weekly_challenge_submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_weekly_challenge_submissions_uid ON public.weekly_challenge_submissions(user_id);


-- 4. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
