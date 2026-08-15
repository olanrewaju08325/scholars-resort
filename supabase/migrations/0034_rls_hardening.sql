-- 0034_rls_hardening.sql
-- Production Hardening Phase 8: RLS & Security Audit

-- 1. admin_settings RLS
-- Anyone can read (so maintenance mode check works) but only admins can write
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read admin settings" ON public.admin_settings;
CREATE POLICY "Public can read admin settings"
ON public.admin_settings FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Admins can modify admin settings" ON public.admin_settings;
CREATE POLICY "Admins can modify admin settings"
ON public.admin_settings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 2. admin_ai_prompts RLS
ALTER TABLE public.admin_ai_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read AI prompts" ON public.admin_ai_prompts;
CREATE POLICY "Anyone can read AI prompts"
ON public.admin_ai_prompts FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can modify AI prompts" ON public.admin_ai_prompts;
CREATE POLICY "Admins can modify AI prompts"
ON public.admin_ai_prompts FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 3. Fix security definer functions to use strict search path
-- Any function using SECURITY DEFINER should have SET search_path = public
-- (Handled for new ones in 0033. We will run an update for existing common ones)

-- 4. Add helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON public.questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_is_active ON public.questions(is_active);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_id ON public.exam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
