-- ==============================================================================
-- Migration: 0040_fix_rls_policies_and_schema_columns.sql
-- Description: 
-- 1. Add missing table columns preventing 400 Bad Request / PGRST204 errors
-- 2. Define is_admin() helper as SECURITY DEFINER with search_path
-- 3. Grant EXECUTE on is_admin() to ALL roles (anon, authenticated, service_role, public)
-- 4. Audit & consolidate RLS policies across all public tables
-- 5. Reload PostgREST schema cache
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD MISSING COLUMNS
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0;

ALTER TABLE public.study_logs 
  ADD COLUMN IF NOT EXISTS subject_id UUID,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 0;

ALTER TABLE public.practice_sessions 
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'untimed';

ALTER TABLE public.device_sessions 
  ADD COLUMN IF NOT EXISTS device_uuid TEXT;

ALTER TABLE public.support_tickets 
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

ALTER TABLE public.manual_payments 
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

-- ------------------------------------------------------------------------------
-- 2. HARDEN IS_ADMIN FUNCTION (SECURITY DEFINER & SEARCH PATH)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Check JWT metadata first for speed
  v_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role');
  IF v_role = 'admin' OR v_role = 'superadmin' THEN
    RETURN true;
  END IF;

  -- Direct profiles check (bypasses RLS because row_security = off inside SECURITY DEFINER)
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin')
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- Crucial: GRANT EXECUTE on is_admin() to ALL roles so policy evaluation never throws 42501
GRANT EXECUTE ON FUNCTION public.is_admin() TO public, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. AUDIT & CONSOLIDATE RLS POLICIES FOR ALL TABLES
-- ------------------------------------------------------------------------------

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own or admin view all" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT USING ((select auth.uid()) = id OR (select public.is_admin()));

CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT WITH CHECK ((select auth.uid()) = id OR (select public.is_admin()));

CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE USING ((select auth.uid()) = id OR (select public.is_admin()))
WITH CHECK ((select auth.uid()) = id OR (select public.is_admin()));

CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE USING ((select public.is_admin()));

-- USER_STATS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_stats_select_policy" ON public.user_stats;
DROP POLICY IF EXISTS "user_stats_insert_policy" ON public.user_stats;
DROP POLICY IF EXISTS "user_stats_update_policy" ON public.user_stats;
DROP POLICY IF EXISTS "user_stats_select" ON public.user_stats;
DROP POLICY IF EXISTS "user_stats_all_admin" ON public.user_stats;

CREATE POLICY "user_stats_select_policy" ON public.user_stats
FOR SELECT USING ((select auth.uid()) = user_id OR (select public.is_admin()));

CREATE POLICY "user_stats_insert_policy" ON public.user_stats
FOR INSERT WITH CHECK ((select auth.uid()) = user_id OR (select public.is_admin()));

CREATE POLICY "user_stats_update_policy" ON public.user_stats
FOR UPDATE USING ((select auth.uid()) = user_id OR (select public.is_admin()))
WITH CHECK ((select auth.uid()) = user_id OR (select public.is_admin()));

-- STUDY_LOGS
ALTER TABLE public.study_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "study_logs_select_policy" ON public.study_logs;
DROP POLICY IF EXISTS "study_logs_insert_policy" ON public.study_logs;
DROP POLICY IF EXISTS "study_logs_update_policy" ON public.study_logs;
DROP POLICY IF EXISTS "study_logs_delete_policy" ON public.study_logs;

CREATE POLICY "study_logs_select_policy" ON public.study_logs
FOR SELECT USING ((select auth.uid()) = user_id OR (select public.is_admin()));

CREATE POLICY "study_logs_insert_policy" ON public.study_logs
FOR INSERT WITH CHECK ((select auth.uid()) = user_id OR (select public.is_admin()));

CREATE POLICY "study_logs_update_policy" ON public.study_logs
FOR UPDATE USING ((select auth.uid()) = user_id OR (select public.is_admin()));

CREATE POLICY "study_logs_delete_policy" ON public.study_logs
FOR DELETE USING ((select auth.uid()) = user_id OR (select public.is_admin()));

-- EXAM_SESSIONS
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exam_sessions_select_policy" ON public.exam_sessions;
DROP POLICY IF EXISTS "exam_sessions_insert_policy" ON public.exam_sessions;
DROP POLICY IF EXISTS "exam_sessions_update_policy" ON public.exam_sessions;

CREATE POLICY "exam_sessions_select_policy" ON public.exam_sessions
FOR SELECT USING ((select auth.uid()) = user_id OR (select public.is_admin()));

CREATE POLICY "exam_sessions_insert_policy" ON public.exam_sessions
FOR INSERT WITH CHECK ((select auth.uid()) = user_id OR (select public.is_admin()));

CREATE POLICY "exam_sessions_update_policy" ON public.exam_sessions
FOR UPDATE USING ((select auth.uid()) = user_id OR (select public.is_admin()));

-- PRACTICE_SESSIONS
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "practice_sessions_select_policy" ON public.practice_sessions;
DROP POLICY IF EXISTS "practice_sessions_insert_policy" ON public.practice_sessions;
DROP POLICY IF EXISTS "practice_sessions_update_policy" ON public.practice_sessions;
DROP POLICY IF EXISTS "practice_sessions_delete_policy" ON public.practice_sessions;

CREATE POLICY "practice_sessions_select_policy" ON public.practice_sessions
FOR SELECT USING ((select auth.uid()) = user_id OR (select public.is_admin()));

CREATE POLICY "practice_sessions_insert_policy" ON public.practice_sessions
FOR INSERT WITH CHECK ((select auth.uid()) = user_id OR (select public.is_admin()));

CREATE POLICY "practice_sessions_update_policy" ON public.practice_sessions
FOR UPDATE USING ((select auth.uid()) = user_id OR (select public.is_admin()));

CREATE POLICY "practice_sessions_delete_policy" ON public.practice_sessions
FOR DELETE USING ((select auth.uid()) = user_id OR (select public.is_admin()));

-- SESSION_ANSWERS
ALTER TABLE public.session_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "session_answers_select_policy" ON public.session_answers;
DROP POLICY IF EXISTS "session_answers_insert_policy" ON public.session_answers;
DROP POLICY IF EXISTS "session_answers_update_policy" ON public.session_answers;

CREATE POLICY "session_answers_select_policy" ON public.session_answers
FOR SELECT USING (
  user_id = (select auth.uid()) OR (select public.is_admin()) OR
  EXISTS (SELECT 1 FROM public.exam_sessions es WHERE es.id = session_answers.exam_session_id AND es.user_id = (select auth.uid())) OR
  EXISTS (SELECT 1 FROM public.practice_sessions ps WHERE ps.id = session_answers.practice_session_id AND ps.user_id = (select auth.uid()))
);

CREATE POLICY "session_answers_insert_policy" ON public.session_answers
FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) OR (select public.is_admin()) OR
  EXISTS (SELECT 1 FROM public.exam_sessions es WHERE es.id = session_answers.exam_session_id AND es.user_id = (select auth.uid())) OR
  EXISTS (SELECT 1 FROM public.practice_sessions ps WHERE ps.id = session_answers.practice_session_id AND ps.user_id = (select auth.uid()))
);

CREATE POLICY "session_answers_update_policy" ON public.session_answers
FOR UPDATE USING (
  user_id = (select auth.uid()) OR (select public.is_admin()) OR
  EXISTS (SELECT 1 FROM public.exam_sessions es WHERE es.id = session_answers.exam_session_id AND es.user_id = (select auth.uid())) OR
  EXISTS (SELECT 1 FROM public.practice_sessions ps WHERE ps.id = session_answers.practice_session_id AND ps.user_id = (select auth.uid()))
);

-- DEVICE SESSIONS
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device_sessions_unified_policy" ON public.device_sessions;
CREATE POLICY "device_sessions_unified_policy" ON public.device_sessions
FOR ALL USING (
  user_id = (select auth.uid()) OR (select public.is_admin())
) WITH CHECK (
  user_id = (select auth.uid()) OR (select public.is_admin())
);

-- SUPPORT TICKETS & REPLIES & MESSAGES
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support_tickets_select_policy" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_insert_policy" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_update_policy" ON public.support_tickets;

CREATE POLICY "support_tickets_select_policy" ON public.support_tickets
FOR SELECT USING (user_id = (select auth.uid()) OR (select public.is_admin()));

CREATE POLICY "support_tickets_insert_policy" ON public.support_tickets
FOR INSERT WITH CHECK (user_id = (select auth.uid()) OR (select public.is_admin()));

CREATE POLICY "support_tickets_update_policy" ON public.support_tickets
FOR UPDATE USING (user_id = (select auth.uid()) OR (select public.is_admin()));

-- MANUAL PAYMENTS
ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "manual_payments_select_policy" ON public.manual_payments;
DROP POLICY IF EXISTS "manual_payments_insert_policy" ON public.manual_payments;
DROP POLICY IF EXISTS "manual_payments_update_policy" ON public.manual_payments;

CREATE POLICY "manual_payments_select_policy" ON public.manual_payments
FOR SELECT USING (user_id = (select auth.uid()) OR (select public.is_admin()));

CREATE POLICY "manual_payments_insert_policy" ON public.manual_payments
FOR INSERT WITH CHECK (user_id = (select auth.uid()) OR (select public.is_admin()));

CREATE POLICY "manual_payments_update_policy" ON public.manual_payments
FOR UPDATE USING ((select public.is_admin()))
WITH CHECK ((select public.is_admin()));

-- PUBLIC READ TABLES (Questions, Subjects, Topics, Announcements, Platform Config, Admin Settings)
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "questions_select_policy" ON public.questions;
DROP POLICY IF EXISTS "questions_admin_policy" ON public.questions;
CREATE POLICY "questions_select_policy" ON public.questions FOR SELECT USING (true);
CREATE POLICY "questions_admin_policy" ON public.questions FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subjects_select_policy" ON public.subjects;
DROP POLICY IF EXISTS "subjects_admin_policy" ON public.subjects;
CREATE POLICY "subjects_select_policy" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "subjects_admin_policy" ON public.subjects FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "topics_select_policy" ON public.topics;
DROP POLICY IF EXISTS "topics_admin_policy" ON public.topics;
CREATE POLICY "topics_select_policy" ON public.topics FOR SELECT USING (true);
CREATE POLICY "topics_admin_policy" ON public.topics FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements_select_policy" ON public.announcements;
DROP POLICY IF EXISTS "announcements_admin_policy" ON public.announcements;
CREATE POLICY "announcements_select_policy" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "announcements_admin_policy" ON public.announcements FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_config_select" ON public.platform_config;
DROP POLICY IF EXISTS "platform_config_admin" ON public.platform_config;
CREATE POLICY "platform_config_select" ON public.platform_config FOR SELECT USING (true);
CREATE POLICY "platform_config_admin" ON public.platform_config FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_settings_select_policy" ON public.admin_settings;
DROP POLICY IF EXISTS "admin_settings_modify_policy" ON public.admin_settings;
CREATE POLICY "admin_settings_select_policy" ON public.admin_settings FOR SELECT USING (true);
CREATE POLICY "admin_settings_modify_policy" ON public.admin_settings FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- ------------------------------------------------------------------------------
-- 4. RELOAD SCHEMA CACHE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

SELECT 'Migration 0040 Completed Successfully! All RLS policies & schema columns updated.' AS status;
