-- 0033_schema_audit.sql
-- Production Hardening Phase 4 & Phase 2

-- 1. Ensure single source of truth for payments
-- Create a trigger that ensures whenever a subscription becomes active, the profile is marked as paid
CREATE OR REPLACE FUNCTION sync_subscription_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.expires_at > NOW() THEN
    UPDATE public.profiles SET has_paid = true WHERE id = NEW.user_id;
  ELSIF NEW.status = 'expired' OR NEW.expires_at <= NOW() THEN
    UPDATE public.profiles SET has_paid = false WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_sync_subscription ON public.subscriptions;
CREATE TRIGGER tr_sync_subscription
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION sync_subscription_to_profile();


-- 2. Add missing columns that might be referenced by frontend
ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS quality_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1;

-- 3. Ensure admin_ai_prompts exists
CREATE TABLE IF NOT EXISTS public.admin_ai_prompts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    prompt_key text UNIQUE NOT NULL,
    prompt_text text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Note: RLS for this table is handled in 0034_rls_hardening.sql

-- 4. Fix increment_xp RPC signature
-- Drop any existing versions first to avoid overload conflicts
DROP FUNCTION IF EXISTS public.increment_xp(uuid, integer);
DROP FUNCTION IF EXISTS public.increment_xp(amount integer);

-- Create canonical version that accepts (p_user_id, p_amount) OR just (amount) if called with auth.uid()
CREATE OR REPLACE FUNCTION public.increment_xp(p_user_id uuid, p_amount integer)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Also create the version that just takes amount for backwards compatibility with TournamentArena
CREATE OR REPLACE FUNCTION public.increment_xp(amount integer)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + amount
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
