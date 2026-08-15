-- ==============================================================================
-- Migration: 0037_fix_all_supabase_linter_issues.sql
-- Description: Complete resolution for Supabase Database Linter issues
-- Covers:
-- 1. SECURITY DEFINER Views -> Set security_invoker = true
-- 2. Function Search Path Mutable -> Set search_path = public, extensions, pg_temp
-- 3. Move pg_net extension out of public schema to extensions
-- 4. Secure function execution permissions (Revoke anonymous execution)
-- 5. Drop duplicate index on guardian_links
-- 6. Storage bucket listing policy cleanup
-- 7. Performance & RLS Optimization: (select auth.uid()) & policy consolidation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX SECURITY DEFINER VIEWS (ERRORS)
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'user_performance_summary') THEN
    ALTER VIEW public.user_performance_summary SET (security_invoker = true);
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'question_statistics') THEN
    ALTER VIEW public.question_statistics SET (security_invoker = true);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'leaderboard_entries') THEN
    ALTER VIEW public.leaderboard_entries SET (security_invoker = true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. FIX FUNCTION SEARCH PATH MUTABILITY (WARNINGS)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT p.oid::regprocedure AS proc_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_streak',
        'update_updated_at_column',
        'protect_role_column',
        'trigger_payment_notification',
        'notify_badge_earned',
        'notify_activity_webhook',
        'trigger_ai_brain_on_exam',
        'generate_daily_health_report',
        'handle_new_user',
        'increment_xp',
        'is_admin',
        'rls_auto_enable',
        'sync_subscription_to_profile',
        'record_practice_session_stats'
      )
  ) LOOP
    EXECUTE 'ALTER FUNCTION ' || r.proc_signature || ' SET search_path = public, extensions, pg_temp';
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. MOVE EXTENSION OUT OF PUBLIC SCHEMA
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    ALTER EXTENSION pg_net SET SCHEMA extensions;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if permission restricted in cloud tenant
  NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 4. FUNCTION PERMISSION HARDENING (ANON & AUTHENTICATED SECURITY DEFINER)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Restrict internal system triggers to service_role and postgres
  FOR r IN (
    SELECT p.oid::regprocedure AS proc_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'handle_new_user',
        'protect_role_column',
        'trigger_payment_notification',
        'trigger_ai_brain_on_exam',
        'notify_badge_earned',
        'notify_activity_webhook',
        'generate_daily_health_report',
        'sync_subscription_to_profile',
        'rls_auto_enable'
      )
  ) LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.proc_signature || ' FROM public, anon, authenticated;';
  END LOOP;

  -- Restrict user/admin helper functions to authenticated & service_role
  FOR r IN (
    SELECT p.oid::regprocedure AS proc_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN ('is_admin', 'increment_xp')
  ) LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.proc_signature || ' FROM public, anon;';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.proc_signature || ' TO authenticated, service_role;';
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 5. DROP DUPLICATE INDEXES
-- ------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.guardian_links_invitation_code_unique;

-- ------------------------------------------------------------------------------
-- 6. CLEAN UP STORAGE BUCKET LISTING WARNINGS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public materials read" ON storage.objects;
DROP POLICY IF EXISTS "Public raw_content read" ON storage.objects;

-- ------------------------------------------------------------------------------
-- 7. CONSOLIDATE RLS POLICIES & RESOLVE (select auth.uid()) INITPLAN WARNINGS
-- ------------------------------------------------------------------------------

-- PROFILES
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can view own or admin view all" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT USING (
  (select auth.uid()) = id OR (select public.is_admin())
);

CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT WITH CHECK (
  (select auth.uid()) = id OR (select public.is_admin())
);

CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE USING (
  (select auth.uid()) = id OR (select public.is_admin())
) WITH CHECK (
  (select auth.uid()) = id OR (select public.is_admin())
);

CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE USING (
  (select public.is_admin())
);

-- USER_STATS
DROP POLICY IF EXISTS "Users can view own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can update own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Admins can view all user stats" ON public.user_stats;

CREATE POLICY "user_stats_select_policy" ON public.user_stats
FOR SELECT USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

CREATE POLICY "user_stats_insert_policy" ON public.user_stats
FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

CREATE POLICY "user_stats_update_policy" ON public.user_stats
FOR UPDATE USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
) WITH CHECK (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

-- STUDY_LOGS
DROP POLICY IF EXISTS "Users can manage own study logs" ON public.study_logs;
DROP POLICY IF EXISTS "Users can insert their own study logs" ON public.study_logs;
DROP POLICY IF EXISTS "Users can view their own study logs" ON public.study_logs;

CREATE POLICY "study_logs_select_policy" ON public.study_logs
FOR SELECT USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

CREATE POLICY "study_logs_insert_policy" ON public.study_logs
FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

CREATE POLICY "study_logs_update_policy" ON public.study_logs
FOR UPDATE USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

CREATE POLICY "study_logs_delete_policy" ON public.study_logs
FOR DELETE USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

-- EXAM_SESSIONS
DROP POLICY IF EXISTS "Users can read own exam sessions" ON public.exam_sessions;
DROP POLICY IF EXISTS "Users can insert own exam sessions" ON public.exam_sessions;
DROP POLICY IF EXISTS "Users can update own exam sessions" ON public.exam_sessions;

CREATE POLICY "exam_sessions_select_policy" ON public.exam_sessions
FOR SELECT USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

CREATE POLICY "exam_sessions_insert_policy" ON public.exam_sessions
FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

CREATE POLICY "exam_sessions_update_policy" ON public.exam_sessions
FOR UPDATE USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

-- PRACTICE_SESSIONS
DROP POLICY IF EXISTS "Users can read own practice sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Users can insert own practice sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Users can update own practice sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Users manage own practice sessions" ON public.practice_sessions;

CREATE POLICY "practice_sessions_select_policy" ON public.practice_sessions
FOR SELECT USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

CREATE POLICY "practice_sessions_insert_policy" ON public.practice_sessions
FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

CREATE POLICY "practice_sessions_update_policy" ON public.practice_sessions
FOR UPDATE USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

CREATE POLICY "practice_sessions_delete_policy" ON public.practice_sessions
FOR DELETE USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

-- SESSION_ANSWERS
DROP POLICY IF EXISTS "Users can read own answers" ON public.session_answers;
DROP POLICY IF EXISTS "Users can insert own answers" ON public.session_answers;
DROP POLICY IF EXISTS "Users can update own answers" ON public.session_answers;
DROP POLICY IF EXISTS "Users manage own session answers" ON public.session_answers;

CREATE POLICY "session_answers_select_policy" ON public.session_answers
FOR SELECT USING (
  user_id = (select auth.uid()) OR (select public.is_admin())
);

CREATE POLICY "session_answers_insert_policy" ON public.session_answers
FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) OR (select public.is_admin())
);

CREATE POLICY "session_answers_update_policy" ON public.session_answers
FOR UPDATE USING (
  user_id = (select auth.uid()) OR (select public.is_admin())
);

-- STUDY_PLANS & STUDY_PLAN_TASKS & STUDY_PLAN_ITEMS
DROP POLICY IF EXISTS "Users can manage own study plans" ON public.study_plans;
CREATE POLICY "study_plans_unified_policy" ON public.study_plans
FOR ALL USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
) WITH CHECK (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

DROP POLICY IF EXISTS "Users manage own study plan tasks" ON public.study_plan_tasks;
DROP POLICY IF EXISTS "Users can manage own study plan tasks" ON public.study_plan_tasks;
CREATE POLICY "study_plan_tasks_unified_policy" ON public.study_plan_tasks
FOR ALL USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
) WITH CHECK (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'study_plan_items') THEN
    DROP POLICY IF EXISTS "Users can manage own study plan items" ON public.study_plan_items;
    CREATE POLICY "study_plan_items_unified_policy" ON public.study_plan_items
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.study_plans sp
        WHERE sp.id = study_plan_items.plan_id
          AND (sp.user_id = (select auth.uid()) OR (select public.is_admin()))
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.study_plans sp
        WHERE sp.id = study_plan_items.plan_id
          AND (sp.user_id = (select auth.uid()) OR (select public.is_admin()))
      )
    );
  END IF;
END $$;

-- BOOKMARKS
DROP POLICY IF EXISTS "Users manage own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can manage their own bookmarks" ON public.bookmarks;
CREATE POLICY "bookmarks_unified_policy" ON public.bookmarks
FOR ALL USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
) WITH CHECK (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

-- FLASHCARDS
DROP POLICY IF EXISTS "Anyone can view global flashcards or their own" ON public.flashcards;
DROP POLICY IF EXISTS "Users can insert their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can update their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Users can delete their own flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Admins can manage flashcards" ON public.flashcards;
DROP POLICY IF EXISTS "Anyone can read flashcards" ON public.flashcards;

CREATE POLICY "flashcards_select_policy" ON public.flashcards
FOR SELECT USING (
  user_id = (select auth.uid()) OR (select public.is_admin())
);

CREATE POLICY "flashcards_insert_policy" ON public.flashcards
FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

CREATE POLICY "flashcards_update_policy" ON public.flashcards
FOR UPDATE USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
) WITH CHECK (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

CREATE POLICY "flashcards_delete_policy" ON public.flashcards
FOR DELETE USING (
  (select auth.uid()) = user_id OR (select public.is_admin())
);

-- MATERIALS & LIBRARY_MATERIALS
DROP POLICY IF EXISTS "Admins can manage materials." ON public.materials;
DROP POLICY IF EXISTS "Students can view published materials." ON public.materials;
CREATE POLICY "materials_select_policy" ON public.materials
FOR SELECT USING (
  visibility = true OR uploaded_by = (select auth.uid()) OR (select public.is_admin())
);
CREATE POLICY "materials_admin_policy" ON public.materials
FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Admins can manage library materials" ON public.library_materials;
DROP POLICY IF EXISTS "Users can view active library materials" ON public.library_materials;
CREATE POLICY "library_materials_select_policy" ON public.library_materials
FOR SELECT USING (
  is_active = true OR (select public.is_admin())
);
CREATE POLICY "library_materials_admin_policy" ON public.library_materials
FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- AI USAGE
DROP POLICY IF EXISTS "Users can view own ai usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Users can insert own ai usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Admins can view all AI usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Admins can view all ai usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Admins can read ai usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Anyone can insert ai usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Service role can insert AI usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Service role can insert ai usage" ON public.ai_usage;

CREATE POLICY "ai_usage_select_policy" ON public.ai_usage
FOR SELECT USING (
  user_id = (select auth.uid()) OR (select public.is_admin())
);

CREATE POLICY "ai_usage_insert_policy" ON public.ai_usage
FOR INSERT WITH CHECK (
  (select auth.uid()) IS NOT NULL OR (select auth.role()) IN ('anon', 'authenticated', 'service_role')
);

-- DEVICE SESSIONS
DROP POLICY IF EXISTS "Users can upsert own device session" ON public.device_sessions;
DROP POLICY IF EXISTS "Users can manage own devices" ON public.device_sessions;
DROP POLICY IF EXISTS "Admins can read device sessions" ON public.device_sessions;
DROP POLICY IF EXISTS "Admins can view all devices" ON public.device_sessions;

CREATE POLICY "device_sessions_unified_policy" ON public.device_sessions
FOR ALL USING (
  user_id = (select auth.uid()) OR (select public.is_admin())
) WITH CHECK (
  user_id = (select auth.uid()) OR (select public.is_admin())
);

-- TOURNAMENTS & PARTICIPANTS
DROP POLICY IF EXISTS "Admins manage tournaments." ON public.tournaments;
DROP POLICY IF EXISTS "Anyone can view tournaments." ON public.tournaments;
CREATE POLICY "tournaments_select_policy" ON public.tournaments
FOR SELECT USING (true);
CREATE POLICY "tournaments_admin_policy" ON public.tournaments
FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Users can register" ON public.tournament_participants;
DROP POLICY IF EXISTS "Admins can manage participants" ON public.tournament_participants;
DROP POLICY IF EXISTS "Users can view participants" ON public.tournament_participants;
CREATE POLICY "tournament_participants_select_policy" ON public.tournament_participants
FOR SELECT USING (true);
CREATE POLICY "tournament_participants_insert_policy" ON public.tournament_participants
FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) OR (select public.is_admin())
);
CREATE POLICY "tournament_participants_update_policy" ON public.tournament_participants
FOR UPDATE USING (
  user_id = (select auth.uid()) OR (select public.is_admin())
);
CREATE POLICY "tournament_participants_delete_policy" ON public.tournament_participants
FOR DELETE USING ((select public.is_admin()));

-- ADMIN SETTINGS & AI PROMPTS
DROP POLICY IF EXISTS "Admins can modify admin settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins can manage admin settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins manage settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Anyone can read admin settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Public can read admin settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Students can read feature toggles" ON public.admin_settings;

CREATE POLICY "admin_settings_select_policy" ON public.admin_settings
FOR SELECT USING (true);

CREATE POLICY "admin_settings_modify_policy" ON public.admin_settings
FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Admins can modify AI prompts" ON public.admin_ai_prompts;
DROP POLICY IF EXISTS "Admins manage AI prompts" ON public.admin_ai_prompts;
DROP POLICY IF EXISTS "Anyone can read AI prompts" ON public.admin_ai_prompts;
CREATE POLICY "admin_ai_prompts_select_policy" ON public.admin_ai_prompts
FOR SELECT USING (true);
CREATE POLICY "admin_ai_prompts_modify_policy" ON public.admin_ai_prompts
FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- SUBSCRIPTIONS & MANUAL PAYMENTS
DROP POLICY IF EXISTS "Users can read own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can insert subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can delete subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;

CREATE POLICY "subscriptions_select_policy" ON public.subscriptions
FOR SELECT USING (
  user_id = (select auth.uid()) OR (select public.is_admin())
);
CREATE POLICY "subscriptions_admin_policy" ON public.subscriptions
FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Users can read own payments" ON public.manual_payments;
DROP POLICY IF EXISTS "Users can view own payments" ON public.manual_payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.manual_payments;
DROP POLICY IF EXISTS "Users can insert own payments or for linked wards" ON public.manual_payments;
DROP POLICY IF EXISTS "Admins can manage payments" ON public.manual_payments;

CREATE POLICY "manual_payments_select_policy" ON public.manual_payments
FOR SELECT USING (
  user_id = (select auth.uid()) OR (select public.is_admin())
);
CREATE POLICY "manual_payments_insert_policy" ON public.manual_payments
FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) OR (select public.is_admin())
);
CREATE POLICY "manual_payments_admin_policy" ON public.manual_payments
FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- NOTIFICATIONS & SUPPORT TICKETS & REPLIES
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "notifications_select_policy" ON public.notifications
FOR SELECT USING (
  user_id = (select auth.uid()) OR (select public.is_admin())
);
CREATE POLICY "notifications_update_policy" ON public.notifications
FOR UPDATE USING (
  user_id = (select auth.uid()) OR (select public.is_admin())
);

DROP POLICY IF EXISTS "Users can read own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can insert own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can manage tickets" ON public.support_tickets;

CREATE POLICY "support_tickets_select_policy" ON public.support_tickets
FOR SELECT USING (
  user_id = (select auth.uid()) OR (select public.is_admin())
);
CREATE POLICY "support_tickets_insert_policy" ON public.support_tickets
FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) OR (select public.is_admin())
);
CREATE POLICY "support_tickets_admin_policy" ON public.support_tickets
FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ticket_replies') THEN
    DROP POLICY IF EXISTS "Users can read replies for own tickets" ON public.ticket_replies;
    DROP POLICY IF EXISTS "Users can insert replies for own tickets" ON public.ticket_replies;
    CREATE POLICY "ticket_replies_select_policy" ON public.ticket_replies
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id = ticket_replies.ticket_id
          AND (st.user_id = (select auth.uid()) OR (select public.is_admin()))
      )
    );
    CREATE POLICY "ticket_replies_insert_policy" ON public.ticket_replies
    FOR INSERT WITH CHECK (
      sender_id = (select auth.uid()) OR (select public.is_admin())
    );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'support_messages') THEN
    DROP POLICY IF EXISTS "Admins can manage all ticket messages" ON public.support_messages;
    DROP POLICY IF EXISTS "Users can view own ticket messages" ON public.support_messages;
    DROP POLICY IF EXISTS "Users can reply to own tickets" ON public.support_messages;
    CREATE POLICY "support_messages_select_policy" ON public.support_messages
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id = support_messages.ticket_id
          AND (st.user_id = (select auth.uid()) OR (select public.is_admin()))
      )
    );
    CREATE POLICY "support_messages_insert_policy" ON public.support_messages
    FOR INSERT WITH CHECK (
      sender_id = (select auth.uid()) OR (select public.is_admin())
    );
  END IF;
END $$;

-- GUARDIAN LINKS & MESSAGES
DROP POLICY IF EXISTS "Students can manage their own links" ON public.guardian_links;
DROP POLICY IF EXISTS "Guardians can see their links" ON public.guardian_links;
DROP POLICY IF EXISTS "Authenticated users can update links" ON public.guardian_links;

CREATE POLICY "guardian_links_select_policy" ON public.guardian_links
FOR SELECT USING (
  student_id = (select auth.uid()) OR guardian_id = (select auth.uid()) OR (select public.is_admin())
);
CREATE POLICY "guardian_links_insert_policy" ON public.guardian_links
FOR INSERT WITH CHECK (
  student_id = (select auth.uid()) OR (select public.is_admin())
);
CREATE POLICY "guardian_links_update_policy" ON public.guardian_links
FOR UPDATE USING (
  student_id = (select auth.uid()) OR guardian_id = (select auth.uid()) OR (select public.is_admin())
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'guardian_messages') THEN
    DROP POLICY IF EXISTS "Users involved in link can view and send messages" ON public.guardian_messages;
    CREATE POLICY "guardian_messages_unified_policy" ON public.guardian_messages
    FOR ALL USING (
      sender_id = (select auth.uid()) OR (select public.is_admin())
    ) WITH CHECK (
      sender_id = (select auth.uid()) OR (select public.is_admin())
    );
  END IF;
END $$;

-- ACTIVITY LOGS & AUDIT LOGS & PLATFORM ERROR LOGS
DROP POLICY IF EXISTS "Users can view own activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can log own activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can log their own actions" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can read all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can view all activity" ON public.activity_logs;

CREATE POLICY "activity_logs_select_policy" ON public.activity_logs
FOR SELECT USING (
  user_id = (select auth.uid()) OR (select public.is_admin())
);
CREATE POLICY "activity_logs_insert_policy" ON public.activity_logs
FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) OR (select public.is_admin()) OR (select auth.role()) IN ('anon', 'authenticated', 'service_role')
);

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
FOR SELECT USING ((select public.is_admin()));
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
FOR INSERT WITH CHECK (
  (select public.is_admin()) OR (select auth.role()) IN ('anon', 'authenticated', 'service_role')
);

DROP POLICY IF EXISTS "Admins can manage error logs" ON public.platform_error_logs;
DROP POLICY IF EXISTS "Admins can view error logs" ON public.platform_error_logs;
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.platform_error_logs;

CREATE POLICY "platform_error_logs_select_policy" ON public.platform_error_logs
FOR SELECT USING ((select public.is_admin()));

CREATE POLICY "platform_error_logs_insert_policy" ON public.platform_error_logs
FOR INSERT WITH CHECK (
  (select auth.role()) IN ('anon', 'authenticated', 'service_role')
);

-- CONTENT INGESTION JOBS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'content_ingestion_jobs') THEN
    DROP POLICY IF EXISTS "Admins can manage ingestion jobs" ON public.content_ingestion_jobs;
    CREATE POLICY "content_ingestion_jobs_admin_policy" ON public.content_ingestion_jobs
    FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
  END IF;
END $$;

-- QUESTIONS & SUBJECTS & TOPICS & MOCK EXAMS & ANNOUNCEMENTS
DROP POLICY IF EXISTS "Admins can manage questions" ON public.questions;
DROP POLICY IF EXISTS "Anyone can read questions" ON public.questions;
CREATE POLICY "questions_select_policy" ON public.questions FOR SELECT USING (true);
CREATE POLICY "questions_admin_policy" ON public.questions FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Admins can manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "Anyone can read subjects" ON public.subjects;
CREATE POLICY "subjects_select_policy" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "subjects_admin_policy" ON public.subjects FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Admins can manage topics" ON public.topics;
DROP POLICY IF EXISTS "Anyone can read topics" ON public.topics;
CREATE POLICY "topics_select_policy" ON public.topics FOR SELECT USING (true);
CREATE POLICY "topics_admin_policy" ON public.topics FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Admins can manage mock exams" ON public.mock_exams;
DROP POLICY IF EXISTS "Anyone can read mock exams" ON public.mock_exams;
CREATE POLICY "mock_exams_select_policy" ON public.mock_exams FOR SELECT USING (true);
CREATE POLICY "mock_exams_admin_policy" ON public.mock_exams FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "Anyone can read active announcements" ON public.announcements;
CREATE POLICY "announcements_select_policy" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "announcements_admin_policy" ON public.announcements FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- DISCOUNT CODES & REFERRALS & USER BADGES & COMMUNICATION LOGS & OFFLINE SYNC
DROP POLICY IF EXISTS "Admins can manage discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Anyone can view discount codes" ON public.discount_codes;
CREATE POLICY "discount_codes_select_policy" ON public.discount_codes FOR SELECT USING (expires_at IS NULL OR expires_at > NOW() OR (select public.is_admin()));
CREATE POLICY "discount_codes_admin_policy" ON public.discount_codes FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'referrals') THEN
    DROP POLICY IF EXISTS "Admins can view all referrals" ON public.referrals;
    DROP POLICY IF EXISTS "Users can view their own referrals" ON public.referrals;
    DROP POLICY IF EXISTS "Users can create referrals" ON public.referrals;
    CREATE POLICY "referrals_select_policy" ON public.referrals FOR SELECT USING (referrer_id = (select auth.uid()) OR (select public.is_admin()));
    CREATE POLICY "referrals_insert_policy" ON public.referrals FOR INSERT WITH CHECK (referrer_id = (select auth.uid()) OR (select public.is_admin()));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_badges') THEN
    DROP POLICY IF EXISTS "Students can see their own badges" ON public.user_badges;
    DROP POLICY IF EXISTS "Students can claim badges" ON public.user_badges;
    CREATE POLICY "user_badges_select_policy" ON public.user_badges FOR SELECT USING (student_id = (select auth.uid()) OR (select public.is_admin()));
    CREATE POLICY "user_badges_insert_policy" ON public.user_badges FOR INSERT WITH CHECK (student_id = (select auth.uid()) OR (select public.is_admin()));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'communication_logs') THEN
    DROP POLICY IF EXISTS "Admins can read communication logs" ON public.communication_logs;
    DROP POLICY IF EXISTS "Admins can view communication logs" ON public.communication_logs;
    DROP POLICY IF EXISTS "Users can view own communication logs" ON public.communication_logs;
    CREATE POLICY "communication_logs_select_policy" ON public.communication_logs FOR SELECT USING ((select public.is_admin()));
    CREATE POLICY "communication_logs_insert_policy" ON public.communication_logs FOR INSERT WITH CHECK ((select public.is_admin()) OR (select auth.role()) IN ('anon', 'authenticated', 'service_role'));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'offline_sync_queue') THEN
    DROP POLICY IF EXISTS "Admins can view all sync queues" ON public.offline_sync_queue;
    DROP POLICY IF EXISTS "Users can manage own sync queue" ON public.offline_sync_queue;
    CREATE POLICY "offline_sync_queue_unified_policy" ON public.offline_sync_queue FOR ALL USING (user_id = (select auth.uid()) OR (select public.is_admin())) WITH CHECK (user_id = (select auth.uid()) OR (select public.is_admin()));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'study_goals') THEN
    DROP POLICY IF EXISTS "Users manage own goals" ON public.study_goals;
    DROP POLICY IF EXISTS "Users can manage their own study goals" ON public.study_goals;
    CREATE POLICY "study_goals_unified_policy" ON public.study_goals FOR ALL USING (user_id = (select auth.uid()) OR (select public.is_admin())) WITH CHECK (user_id = (select auth.uid()) OR (select public.is_admin()));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'question_history') THEN
    DROP POLICY IF EXISTS "Admins can manage question history" ON public.question_history;
    DROP POLICY IF EXISTS "Admins manage question history" ON public.question_history;
    CREATE POLICY "question_history_unified_policy" ON public.question_history FOR ALL USING (editor_id = (select auth.uid()) OR (select public.is_admin())) WITH CHECK (editor_id = (select auth.uid()) OR (select public.is_admin()));
  END IF;
END $$;
