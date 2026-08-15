-- Migration for Email Automation Triggers
-- Note: Replace 'https://<your-project>.supabase.co/functions/v1/communication-center' with the actual edge function URL 
-- or use pg_net if pg_net extension is enabled, but typically in Supabase we can use webhooks or database webhooks UI.
-- For this setup, we'll create the triggers using Supabase's HTTP extension if available, or just document the webhook creation.

-- Since Supabase standardizes on using the Dashboard / Webhooks UI for Edge Function triggers to avoid raw pg_net issues,
-- we'll create a generic function using pg_net (assuming pg_net is enabled)

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Check if action column exists in activity_logs, if not, check for other possible column names
DO $$
DECLARE
    col_exists boolean;
    action_col_name text := 'action'; -- Default
BEGIN
    -- Check if 'action' column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'activity_logs' 
               AND column_name = 'action') THEN
        action_col_name := 'action';
    -- Check if 'event_type' column exists
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'activity_logs' 
                  AND column_name = 'event_type') THEN
        action_col_name := 'event_type';
    -- Check if 'type' column exists
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'activity_logs' 
                  AND column_name = 'type') THEN
        action_col_name := 'type';
    ELSE
        -- If no suitable column exists, create it
        ALTER TABLE public.activity_logs ADD COLUMN action TEXT DEFAULT 'other';
        action_col_name := 'action';
    END IF;
    
    -- Store the column name for use in the trigger
    PERFORM set_config('my.activity_logs_action_column', action_col_name, true);
END $$;

CREATE OR REPLACE FUNCTION notify_badge_earned()
RETURNS trigger AS $$
DECLARE
  profile_rec record;
  req_id bigint;
  action_value text;
BEGIN
  -- Get the action value based on which column exists
  IF TG_ARGV[0] IS NOT NULL THEN
    -- Use the column name passed as an argument
    EXECUTE format('SELECT ($1).%I', TG_ARGV[0]) INTO action_value USING NEW;
  ELSE
    -- Try to determine the action value
    BEGIN
      IF NEW.action IS NOT NULL THEN
        action_value := NEW.action;
      ELSIF NEW.event_type IS NOT NULL THEN
        action_value := NEW.event_type;
      ELSIF NEW.type IS NOT NULL THEN
        action_value := NEW.type;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        action_value := 'unknown';
    END;
  END IF;
  
  -- Check if this is a badge_earned event
  IF action_value = 'badge_earned' THEN
    -- Get user email and name
    SELECT email, full_name INTO profile_rec FROM profiles WHERE id = NEW.user_id;
    
    IF profile_rec.email IS NOT NULL AND profile_rec.email != '' THEN
      SELECT net.http_post(
          url:='https://dmykugqgldowtyrksuzm.supabase.co/functions/v1/communication-center',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
          body:=json_build_object(
              'to', profile_rec.email,
              'templateName', 'badge_earned',
              'payload', json_build_object(
                  'name', COALESCE(profile_rec.full_name, 'Student'),
                  'badgeName', COALESCE(NEW.metadata->>'badge_name', 'Achievement Unlocked'),
                  'badgeIcon', COALESCE(NEW.metadata->>'badge_icon', '🏆')
              )
          )::jsonb
      ) INTO req_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_badge_earned ON public.activity_logs;

-- Create trigger on INSERT
CREATE TRIGGER trigger_badge_earned
AFTER INSERT ON public.activity_logs
FOR EACH ROW
EXECUTE FUNCTION notify_badge_earned();

-- Alternative simpler approach: Use a generic trigger for all inserts
-- This catches all activity and filters internally
CREATE OR REPLACE FUNCTION notify_activity_webhook()
RETURNS trigger AS $$
DECLARE
  profile_rec record;
  req_id bigint;
  action_value text := COALESCE(NEW.action, NEW.event_type, NEW.type, 'unknown');
  badge_name text := COALESCE(NEW.metadata->>'badge_name', 'Achievement Unlocked');
  badge_icon text := COALESCE(NEW.metadata->>'badge_icon', '🏆');
BEGIN
  -- Only send for badge_earned events
  IF action_value = 'badge_earned' THEN
    -- Get user email and name
    SELECT email, full_name INTO profile_rec FROM profiles WHERE id = NEW.user_id;
    
    IF profile_rec.email IS NOT NULL AND profile_rec.email != '' THEN
      SELECT net.http_post(
          url:='https://dmykugqgldowtyrksuzm.supabase.co/functions/v1/communication-center',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
          body:=json_build_object(
              'to', profile_rec.email,
              'templateName', 'badge_earned',
              'payload', json_build_object(
                  'name', COALESCE(profile_rec.full_name, 'Student'),
                  'badgeName', badge_name,
                  'badgeIcon', badge_icon
              )
          )::jsonb
      ) INTO req_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternative trigger (uncomment to use)
-- DROP TRIGGER IF EXISTS trigger_activity_webhook ON public.activity_logs;
-- CREATE TRIGGER trigger_activity_webhook
-- AFTER INSERT ON public.activity_logs
-- FOR EACH ROW
-- EXECUTE FUNCTION notify_activity_webhook();

-- Payment Triggers are already handled explicitly in PaymentsTab.tsx for precise control.
-- Tournament triggers could be similarly configured.