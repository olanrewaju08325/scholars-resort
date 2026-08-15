-- ==============================================================================
-- Migration: 0039_database_enhancements_and_linter_fixes.sql
-- Description:
-- 1. Full-Text Search GIN index and search_questions RPC
-- 2. User Stats Aggregation Trigger & Table
-- 3. Achievements & Badges table
-- 4. Platform Config (Maintenance mode, SMTP, AI settings, Landing customization)
-- 5. Fix Linter Security Warnings (pg_net schema, SECURITY INVOKER on functions)
-- 6. Clean up duplicate permissive policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FULL-TEXT SEARCH (FTS) INDEX & RPC
-- ------------------------------------------------------------------------------
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS fts tsvector 
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(question_text, '') || ' ' || coalesce(explanation, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_questions_fts ON public.questions USING gin(fts);

CREATE OR REPLACE FUNCTION public.search_questions(
  search_query text,
  p_subject_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  subject_id uuid,
  topic_id uuid,
  question_text text,
  options jsonb,
  correct_answer text,
  explanation text,
  difficulty text,
  year integer,
  rank real
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.subject_id,
    q.topic_id,
    q.question_text,
    q.options,
    q.correct_answer,
    q.explanation,
    q.difficulty,
    q.year,
    ts_rank(q.fts, websearch_to_tsquery('english', search_query)) AS rank
  FROM public.questions q
  WHERE (p_subject_id IS NULL OR q.subject_id = p_subject_id)
    AND q.fts @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. AUTOMATED USER STATS AGGREGATION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_questions_answered integer DEFAULT 0,
  correct_answers integer DEFAULT 0,
  accuracy_percentage numeric(5,2) DEFAULT 0.00,
  exams_completed integer DEFAULT 0,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_stats_select" ON public.user_stats;
DROP POLICY IF EXISTS "user_stats_all_admin" ON public.user_stats;
CREATE POLICY "user_stats_select" ON public.user_stats FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "user_stats_all_admin" ON public.user_stats FOR ALL USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.trg_update_user_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_total int;
  v_correct int;
  v_accuracy numeric;
BEGIN
  IF TG_TABLE_NAME = 'session_answers' THEN
    SELECT user_id INTO v_user_id FROM public.exam_sessions WHERE id = NEW.exam_session_id;
    IF v_user_id IS NULL THEN
      SELECT user_id INTO v_user_id FROM public.practice_sessions WHERE id = NEW.practice_session_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'exam_sessions' THEN
    v_user_id := NEW.user_id;
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT 
      count(*),
      count(*) FILTER (WHERE is_correct = true)
    INTO v_total, v_correct
    FROM public.session_answers sa
    LEFT JOIN public.exam_sessions es ON sa.exam_session_id = es.id
    LEFT JOIN public.practice_sessions ps ON sa.practice_session_id = ps.id
    WHERE es.user_id = v_user_id OR ps.user_id = v_user_id;

    IF v_total > 0 THEN
      v_accuracy := round((v_correct::numeric / v_total::numeric) * 100, 2);
    ELSE
      v_accuracy := 0.00;
    END IF;

    INSERT INTO public.user_stats (user_id, total_questions_answered, correct_answers, accuracy_percentage, updated_at)
    VALUES (v_user_id, v_total, v_correct, v_accuracy, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      total_questions_answered = EXCLUDED.total_questions_answered,
      correct_answers = EXCLUDED.correct_answers,
      accuracy_percentage = EXCLUDED.accuracy_percentage,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_answers_stats ON public.session_answers;
CREATE TRIGGER trg_session_answers_stats
  AFTER INSERT OR UPDATE ON public.session_answers
  FOR EACH ROW EXECUTE FUNCTION public.trg_update_user_stats();

-- ------------------------------------------------------------------------------
-- 3. ACHIEVEMENTS & BADGES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  icon text DEFAULT 'Award',
  unlocked_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(user_id, badge_key)
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achievements_select_policy" ON public.achievements;
DROP POLICY IF EXISTS "achievements_insert_policy" ON public.achievements;
CREATE POLICY "achievements_select_policy" ON public.achievements FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "achievements_insert_policy" ON public.achievements FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 4. PLATFORM CONFIG (Maintenance Mode, SMTP, AI API keys, Landing Customization)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_config_select" ON public.platform_config;
DROP POLICY IF EXISTS "platform_config_admin" ON public.platform_config;
CREATE POLICY "platform_config_select" ON public.platform_config FOR SELECT USING (true);
CREATE POLICY "platform_config_admin" ON public.platform_config FOR ALL USING (public.is_admin());

INSERT INTO public.platform_config (key, value)
VALUES 
  ('maintenance_mode', '{"enabled": false, "message": "Platform undergoing scheduled maintenance. Admin access active."}'::jsonb),
  ('smtp_settings', '{"host": "", "port": 587, "user": "", "pass": "", "from": "", "enabled": false}'::jsonb),
  ('ai_api_settings', '{"groq_api_key": "", "gemini_api_key": "", "token_usage_count": 0, "quota_warning_threshold": 80}'::jsonb),
  ('landing_customization', '{"title": "Scholars Resort CBT & E-Learning Platform", "subtitle": "Master JAMB, WAEC, NECO & UTME Exams with AI Explanations and Realistic Exam Engine", "hero_images": ["https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1600", "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1600", "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1600"], "primary_color": "#16a34a", "brand_logo": "/logo.svg"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. LINTER SECURITY & PERMISSION FIXES
-- ------------------------------------------------------------------------------

-- Relocate pg_net extension out of public if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    ALTER EXTENSION pg_net SET SCHEMA extensions;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Fix security definer warnings on public functions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'increment_xp') THEN
    ALTER FUNCTION public.increment_xp(integer) SECURITY INVOKER;
    ALTER FUNCTION public.increment_xp(uuid, integer) SECURITY INVOKER;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'is_admin') THEN
    ALTER FUNCTION public.is_admin() SECURITY INVOKER;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Consolidated RLS Policies Cleanup (Remove duplicate permissive SELECT/INSERT policies)
DO $$
BEGIN
  -- Cleanup admin_ai_prompts
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_ai_prompts' AND policyname = 'admin_ai_prompts_modify_policy') THEN
    DROP POLICY IF EXISTS "admin_ai_prompts_modify_policy" ON public.admin_ai_prompts;
  END IF;
  
  -- Cleanup admin_settings
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_settings' AND policyname = 'admin_settings_modify_policy') THEN
    DROP POLICY IF EXISTS "admin_settings_modify_policy" ON public.admin_settings;
  END IF;

  -- Cleanup announcements
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'announcements' AND policyname = 'announcements_admin_policy') THEN
    DROP POLICY IF EXISTS "announcements_admin_policy" ON public.announcements;
  END IF;

  -- Cleanup discount_codes
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'discount_codes' AND policyname = 'discount_codes_admin_policy') THEN
    DROP POLICY IF EXISTS "discount_codes_admin_policy" ON public.discount_codes;
  END IF;

  -- Cleanup library_materials
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'library_materials' AND policyname = 'library_materials_admin_policy') THEN
    DROP POLICY IF EXISTS "library_materials_admin_policy" ON public.library_materials;
  END IF;

  -- Cleanup manual_payments
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_payments' AND policyname = 'manual_payments_admin_policy') THEN
    DROP POLICY IF EXISTS "manual_payments_admin_policy" ON public.manual_payments;
  END IF;

  -- Cleanup materials
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'materials' AND policyname = 'materials_admin_policy') THEN
    DROP POLICY IF EXISTS "materials_admin_policy" ON public.materials;
  END IF;

  -- Cleanup mock_exams
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mock_exams' AND policyname = 'mock_exams_admin_policy') THEN
    DROP POLICY IF EXISTS "mock_exams_admin_policy" ON public.mock_exams;
  END IF;

  -- Cleanup platform_announcements
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'platform_announcements' AND policyname = 'Admins can manage announcements') THEN
    DROP POLICY IF EXISTS "Admins can manage announcements" ON public.platform_announcements;
  END IF;

  -- Cleanup questions
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'questions' AND policyname = 'questions_admin_policy') THEN
    DROP POLICY IF EXISTS "questions_admin_policy" ON public.questions;
  END IF;

  -- Cleanup subjects
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subjects' AND policyname = 'subjects_admin_policy') THEN
    DROP POLICY IF EXISTS "subjects_admin_policy" ON public.subjects;
  END IF;

  -- Cleanup subscriptions
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'subscriptions_admin_policy') THEN
    DROP POLICY IF EXISTS "subscriptions_admin_policy" ON public.subscriptions;
  END IF;

  -- Cleanup support_tickets
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'support_tickets_admin_policy') THEN
    DROP POLICY IF EXISTS "support_tickets_admin_policy" ON public.support_tickets;
  END IF;

  -- Cleanup topics
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'topics' AND policyname = 'topics_admin_policy') THEN
    DROP POLICY IF EXISTS "topics_admin_policy" ON public.topics;
  END IF;

  -- Cleanup tournaments
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tournaments' AND policyname = 'tournaments_admin_policy') THEN
    DROP POLICY IF EXISTS "tournaments_admin_policy" ON public.tournaments;
  END IF;
END $$;
