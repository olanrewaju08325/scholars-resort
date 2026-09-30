-- Migration: 0047_user_subscription_status_and_admin_management.sql
-- Description: Ensures full persistence for user subscription status (Free vs Premium), 
-- account statuses (Active, Suspended, Banned), subscriptions table RLS policies, 
-- and admin role trigger bypasses.

-- 1. Ensure public.profiles has all necessary status and subscription columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'Free Tier',
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Synchronize subscription_plan for existing accounts
UPDATE public.profiles 
SET subscription_plan = 'Lifetime Premium' 
WHERE has_paid = true AND (subscription_plan IS NULL OR subscription_plan = 'Free Tier');

UPDATE public.profiles 
SET status = 'active' 
WHERE status IS NULL;

-- 3. Update protect_role_column() function so administrators & backend superuser can change roles seamlessly
CREATE OR REPLACE FUNCTION public.protect_role_column() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_user IN ('postgres', 'supabase_admin') 
       OR (SELECT auth.role()) IN ('service_role', 'supabase_admin') 
       OR (SELECT public.is_admin()) 
       OR NEW.email IN ('admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com') THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Only authorized administrators or service_role can modify user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Complete RLS Policies on subscriptions table
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select_policy ON public.subscriptions;
CREATE POLICY subscriptions_select_policy ON public.subscriptions 
FOR SELECT USING (
  user_id = (SELECT auth.uid()) OR (SELECT is_admin())
);

DROP POLICY IF EXISTS subscriptions_insert_policy ON public.subscriptions;
CREATE POLICY subscriptions_insert_policy ON public.subscriptions 
FOR INSERT WITH CHECK (
  user_id = (SELECT auth.uid()) OR (SELECT is_admin())
);

DROP POLICY IF EXISTS subscriptions_update_policy ON public.subscriptions;
CREATE POLICY subscriptions_update_policy ON public.subscriptions 
FOR UPDATE USING (
  user_id = (SELECT auth.uid()) OR (SELECT is_admin())
);

DROP POLICY IF EXISTS subscriptions_delete_policy ON public.subscriptions;
CREATE POLICY subscriptions_delete_policy ON public.subscriptions 
FOR DELETE USING (
  (SELECT is_admin())
);
