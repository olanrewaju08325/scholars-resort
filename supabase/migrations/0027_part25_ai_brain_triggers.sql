-- Phase 25: AI Brain Event Triggers Schema
-- Run this in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION trigger_ai_brain_on_exam()
RETURNS trigger AS $$
DECLARE
  req_id bigint;
  payload jsonb;
BEGIN
  -- Construct the webhook payload
  payload := json_build_object(
    'type', 'INSERT',
    'table', 'exam_sessions',
    'record', row_to_json(NEW)
  );

  -- Call the AI Brain Edge Function
  -- Replace the URL with the actual project edge function URL
  SELECT net.http_post(
      url:='https://dmykugqgldowtyrksuzm.supabase.co/functions/v1/ai-brain',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:=payload
  ) INTO req_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_ai_brain_exam_session ON public.exam_sessions;

CREATE TRIGGER trigger_ai_brain_exam_session
AFTER INSERT ON public.exam_sessions
FOR EACH ROW
EXECUTE FUNCTION trigger_ai_brain_on_exam();
