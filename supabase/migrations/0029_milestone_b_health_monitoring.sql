-- Milestone B: Production Hardening
-- Nightly AI Health Check + Platform Monitoring Tables

-- 1. DAILY HEALTH REPORTS TABLE (Auto-generated nightly by AI Brain cron)
CREATE TABLE IF NOT EXISTS public.daily_health_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    generated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    -- Question Bank Health
    bad_questions_count INTEGER DEFAULT 0,
    duplicate_questions_count INTEGER DEFAULT 0,
    draft_questions_count INTEGER DEFAULT 0,
    questions_flagged_for_review INTEGER DEFAULT 0,
    -- Communication Health
    smtp_failures_count INTEGER DEFAULT 0,
    failed_emails_count INTEGER DEFAULT 0,
    -- AI Health
    ai_failures_count INTEGER DEFAULT 0,
    ai_avg_response_ms INTEGER DEFAULT 0,
    total_ai_tokens_used BIGINT DEFAULT 0,
    -- Platform Health
    active_users_24h INTEGER DEFAULT 0,
    exams_taken_24h INTEGER DEFAULT 0,
    error_rate_percent NUMERIC(5,2) DEFAULT 0,
    -- Storage Health
    storage_objects INTEGER DEFAULT 0,
    -- Overall Status
    overall_status TEXT DEFAULT 'healthy', -- healthy, warning, critical
    issues_detected JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    ai_narrative TEXT -- AI-generated health summary
);

ALTER TABLE public.daily_health_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view health reports"
    ON public.daily_health_reports FOR SELECT
    USING (public.is_admin());

-- 2. PLATFORM ERROR LOGS
CREATE TABLE IF NOT EXISTS public.platform_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    error_type TEXT NOT NULL, -- 'edge_function', 'smtp', 'ai', 'payment', 'storage'
    error_message TEXT,
    error_context JSONB,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ
);

ALTER TABLE public.platform_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage error logs"
    ON public.platform_error_logs FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 3. ENABLE pg_cron EXTENSION (run this first in Supabase SQL Editor)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 4. NIGHTLY HEALTH CHECK CRON JOB
-- This function generates the health report automatically
CREATE OR REPLACE FUNCTION generate_daily_health_report()
RETURNS void AS $$
DECLARE
    v_bad_questions INTEGER;
    v_draft_questions INTEGER;
    v_smtp_failures INTEGER;
    v_active_users INTEGER;
    v_exams_24h INTEGER;
    v_issues JSONB := '[]'::JSONB;
    v_recommendations JSONB := '[]'::JSONB;
    v_status TEXT := 'healthy';
BEGIN
    -- Count questions with low quality score
    SELECT COUNT(*) INTO v_bad_questions FROM public.questions WHERE quality_score < 70 AND is_active = true;
    SELECT COUNT(*) INTO v_draft_questions FROM public.questions WHERE is_draft = true AND is_active = true;
    
    -- Count SMTP failures in last 24h
    SELECT COUNT(*) INTO v_smtp_failures FROM public.communication_logs 
    WHERE status IN ('failed', 'retrying') AND created_at > NOW() - INTERVAL '24 hours';
    
    -- Active users in 24h
    SELECT COUNT(DISTINCT user_id) INTO v_active_users FROM public.exam_sessions 
    WHERE started_at > NOW() - INTERVAL '24 hours';
    
    -- Exams taken in 24h
    SELECT COUNT(*) INTO v_exams_24h FROM public.exam_sessions 
    WHERE started_at > NOW() - INTERVAL '24 hours';
    
    -- Build issues list
    IF v_bad_questions > 0 THEN
        v_issues := v_issues || json_build_array(json_build_object('type', 'question_quality', 'detail', format('%s questions with poor quality score', v_bad_questions)));
        v_status := 'warning';
    END IF;
    
    IF v_smtp_failures > 0 THEN
        v_issues := v_issues || json_build_array(json_build_object('type', 'smtp_failure', 'detail', format('%s SMTP failures in last 24 hours', v_smtp_failures)));
        v_status := 'warning';
    END IF;
    
    -- Build recommendations
    IF v_draft_questions > 10 THEN
        v_recommendations := v_recommendations || json_build_array(json_build_object('action', 'Review and publish pending draft questions in Content Studio'));
    END IF;
    
    -- Insert the report
    INSERT INTO public.daily_health_reports (
        report_date, bad_questions_count, draft_questions_count, 
        smtp_failures_count, active_users_24h, exams_taken_24h, 
        overall_status, issues_detected, recommendations,
        ai_narrative
    ) VALUES (
        CURRENT_DATE, v_bad_questions, v_draft_questions,
        v_smtp_failures, v_active_users, v_exams_24h,
        v_status, v_issues, v_recommendations,
        format('Daily Health Report: Platform status is %s. %s active users today. %s exams completed. %s draft questions pending review.',
            upper(v_status), v_active_users, v_exams_24h, v_draft_questions)
    )
    ON CONFLICT (report_date) DO UPDATE SET
        bad_questions_count = EXCLUDED.bad_questions_count,
        draft_questions_count = EXCLUDED.draft_questions_count,
        smtp_failures_count = EXCLUDED.smtp_failures_count,
        active_users_24h = EXCLUDED.active_users_24h,
        exams_taken_24h = EXCLUDED.exams_taken_24h,
        overall_status = EXCLUDED.overall_status,
        issues_detected = EXCLUDED.issues_detected,
        recommendations = EXCLUDED.recommendations,
        ai_narrative = EXCLUDED.ai_narrative,
        generated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ADD UNIQUE CONSTRAINT ON REPORT DATE
ALTER TABLE public.daily_health_reports DROP CONSTRAINT IF EXISTS daily_health_reports_report_date_key;
ALTER TABLE public.daily_health_reports ADD CONSTRAINT daily_health_reports_report_date_key UNIQUE (report_date);

-- 6. SCHEDULE THE CRON JOB (Run midnight Nigeria time = 23:00 UTC)
-- Uncomment after enabling pg_cron extension:
-- SELECT cron.schedule('nightly-health-check', '0 23 * * *', 'SELECT generate_daily_health_report()');
