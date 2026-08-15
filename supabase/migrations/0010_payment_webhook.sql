-- V10: Payment Webhook Trigger
-- This creates a database trigger that fires a webhook (via pg_net) to our Edge Function
-- whenever a new manual payment receipt is uploaded by a student.

-- Enable pg_net extension if it isn't already (Supabase requires this for HTTP requests from DB)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.trigger_payment_notification()
RETURNS TRIGGER AS $$
DECLARE
  -- Replace this with your actual Supabase Edge Function URL once deployed!
  -- e.g. 'https://<your-project-id>.supabase.co/functions/v1/payment-notification'
  webhook_url text := current_setting('app.settings.edge_function_url', true);
  payload jsonb;
BEGIN
  -- If the URL isn't set in the database settings, fallback to a local/placeholder
  IF webhook_url IS NULL OR webhook_url = '' THEN
    webhook_url := 'http://host.docker.internal:54321/functions/v1/payment-notification';
  END IF;

  -- Build the JSON payload to send
  payload := json_build_object(
    'type', 'INSERT',
    'table', TG_TABLE_NAME,
    'record', row_to_json(NEW)
  );

  -- Perform the async HTTP POST request using pg_net
  PERFORM net.http_post(
      url := webhook_url,
      body := payload,
      headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists
DROP TRIGGER IF EXISTS on_manual_payment_inserted ON public.manual_payments;

-- Create the trigger on the manual_payments table
CREATE TRIGGER on_manual_payment_inserted
AFTER INSERT ON public.manual_payments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_payment_notification();
