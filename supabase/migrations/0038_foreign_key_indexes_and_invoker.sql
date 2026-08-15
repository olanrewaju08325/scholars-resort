-- ==============================================================================
-- Migration: 0038_foreign_key_indexes_and_invoker.sql
-- Description: 
-- 1. Index all foreign keys identified in the Supabase Linter report
-- 2. Confirm security_invoker = true on views
-- 3. Set functions to SECURITY INVOKER where appropriate
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. COVERING INDEXES FOR ALL FOREIGN KEYS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_admin_backups_initiated_by ON public.admin_backups (initiated_by);
CREATE INDEX IF NOT EXISTS idx_admin_settings_updated_by ON public.admin_settings (updated_by);
CREATE INDEX IF NOT EXISTS idx_bookmarks_question_id ON public.bookmarks (question_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks (user_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_recipient_id ON public.communication_logs (recipient_id);
CREATE INDEX IF NOT EXISTS idx_content_ingestion_jobs_admin_id ON public.content_ingestion_jobs (admin_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON public.flashcards (user_id);
CREATE INDEX IF NOT EXISTS idx_guardian_links_guardian_id ON public.guardian_links (guardian_id);
CREATE INDEX IF NOT EXISTS idx_guardian_links_student_id ON public.guardian_links (student_id);
CREATE INDEX IF NOT EXISTS idx_guardian_messages_link_id ON public.guardian_messages (link_id);
CREATE INDEX IF NOT EXISTS idx_guardian_messages_sender_id ON public.guardian_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_library_materials_subject_id ON public.library_materials (subject_id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_verified_by ON public.manual_payments (verified_by);
CREATE INDEX IF NOT EXISTS idx_materials_subject_id ON public.materials (subject_id);
CREATE INDEX IF NOT EXISTS idx_materials_uploaded_by ON public.materials (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_platform_announcements_created_by ON public.platform_announcements (created_by);
CREATE INDEX IF NOT EXISTS idx_question_history_editor_id ON public.question_history (editor_id);
CREATE INDEX IF NOT EXISTS idx_question_history_question_id ON public.question_history (question_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals (referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_items_plan_id ON public.study_plan_items (plan_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_tasks_subject_id ON public.study_plan_tasks (subject_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_tasks_topic_id ON public.study_plan_tasks (topic_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON public.study_plans (user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender_id ON public.support_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON public.support_messages (ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_sender_id ON public.ticket_replies (sender_id);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket_id ON public.ticket_replies (ticket_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_user_id ON public.tournament_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by ON public.tournaments (created_by);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON public.user_badges (badge_id);

-- ------------------------------------------------------------------------------
-- 2. ENSURE ALL VIEWS USE SECURITY INVOKER
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
