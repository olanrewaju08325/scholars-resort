-- Migration: 0047_user_subscription_status_and_referral_engine.sql
-- Description: Complete schema and security setup for subscriptions, account status,
-- and the referral commission & payout engine.

-- 1. Ensure public.profiles has all necessary status, subscription and referral columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'Free Tier',
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS referral_code TEXT,
ADD COLUMN IF NOT EXISTS referred_by UUID,
ADD COLUMN IF NOT EXISTS referral_code_used TEXT,
ADD COLUMN IF NOT EXISTS referral_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0;

-- 2. Synchronize subscription_plan for existing accounts
UPDATE public.profiles 
SET subscription_plan = 'Lifetime Premium' 
WHERE has_paid = true AND (subscription_plan IS NULL OR subscription_plan = 'Free Tier');

UPDATE public.profiles 
SET status = 'active' 
WHERE status IS NULL;

-- 3. Enhance public.referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  converted BOOLEAN DEFAULT false,
  reward_amount NUMERIC DEFAULT 500,
  status TEXT DEFAULT 'completed',
  referred_email TEXT,
  referred_name TEXT,
  amount_paid NUMERIC DEFAULT 0,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.referrals 
ADD COLUMN IF NOT EXISTS reward_amount NUMERIC DEFAULT 500,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS referred_email TEXT,
ADD COLUMN IF NOT EXISTS referred_name TEXT,
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Enhance public.payout_requests table
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payout_type TEXT DEFAULT 'bank',
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  airtime_network TEXT,
  airtime_phone TEXT,
  status TEXT DEFAULT 'pending',
  admin_note TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Update protect_role_column() function
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

-- 6. Enable RLS on subscriptions, referrals, and payout_requests
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select_policy ON public.subscriptions;
CREATE POLICY subscriptions_select_policy ON public.subscriptions FOR SELECT USING (
  user_id = (SELECT auth.uid()) OR (SELECT is_admin())
);

DROP POLICY IF EXISTS subscriptions_insert_policy ON public.subscriptions;
CREATE POLICY subscriptions_insert_policy ON public.subscriptions FOR INSERT WITH CHECK (
  user_id = (SELECT auth.uid()) OR (SELECT is_admin())
);

DROP POLICY IF EXISTS subscriptions_update_policy ON public.subscriptions;
CREATE POLICY subscriptions_update_policy ON public.subscriptions FOR UPDATE USING (
  user_id = (SELECT auth.uid()) OR (SELECT is_admin())
);

DROP POLICY IF EXISTS subscriptions_delete_policy ON public.subscriptions;
CREATE POLICY subscriptions_delete_policy ON public.subscriptions FOR DELETE USING (
  (SELECT is_admin())
);

DROP POLICY IF EXISTS referrals_select_policy ON public.referrals;
CREATE POLICY referrals_select_policy ON public.referrals FOR SELECT USING (
  referrer_id = (SELECT auth.uid()) OR referred_id = (SELECT auth.uid()) OR (SELECT is_admin())
);

DROP POLICY IF EXISTS referrals_insert_policy ON public.referrals;
CREATE POLICY referrals_insert_policy ON public.referrals FOR INSERT WITH CHECK (
  referrer_id = (SELECT auth.uid()) OR (SELECT is_admin()) OR (SELECT auth.role()) = 'service_role'
);

DROP POLICY IF EXISTS referrals_update_policy ON public.referrals;
CREATE POLICY referrals_update_policy ON public.referrals FOR UPDATE USING (
  referrer_id = (SELECT auth.uid()) OR (SELECT is_admin()) OR (SELECT auth.role()) = 'service_role'
);

DROP POLICY IF EXISTS payout_requests_select ON public.payout_requests;
CREATE POLICY payout_requests_select ON public.payout_requests FOR SELECT USING (
  user_id = (SELECT auth.uid()) OR (SELECT is_admin()) OR (SELECT auth.role()) = 'service_role'
);

DROP POLICY IF EXISTS payout_requests_insert ON public.payout_requests;
CREATE POLICY payout_requests_insert ON public.payout_requests FOR INSERT WITH CHECK (
  user_id = (SELECT auth.uid()) OR (SELECT is_admin()) OR (SELECT auth.role()) = 'service_role'
);

DROP POLICY IF EXISTS payout_requests_update ON public.payout_requests;
CREATE POLICY payout_requests_update ON public.payout_requests FOR UPDATE USING (
  (SELECT is_admin()) OR (SELECT auth.role()) = 'service_role'
);
