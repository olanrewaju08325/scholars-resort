-- Migration: 0048_referral_engine_and_payouts_persistence.sql
-- Description: Ensures full persistence, unique constraints, and RLS policies for referrals and payout_requests tables.

-- 1. Ensure referrals table exists with complete columns
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  referred_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  converted BOOLEAN DEFAULT false,
  reward_amount NUMERIC DEFAULT 500,
  status TEXT DEFAULT 'pending',
  referred_email TEXT,
  referred_name TEXT,
  amount_paid NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  converted_at TIMESTAMPTZ
);

-- Ensure all columns exist on public.referrals
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referred_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS converted BOOLEAN DEFAULT false;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS reward_amount NUMERIC DEFAULT 500;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referred_email TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referred_name TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- Unique index to prevent duplicate referral records for the same referrer and referred student
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referrer_referred 
ON public.referrals (referrer_id, referred_id) 
WHERE referred_id IS NOT NULL;

-- 2. Ensure payout_requests table exists with complete columns
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  payout_type TEXT DEFAULT 'bank',
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  airtime_network TEXT,
  airtime_phone TEXT,
  status TEXT DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Ensure all columns exist on public.payout_requests
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 2000;
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS payout_type TEXT DEFAULT 'bank';
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS airtime_network TEXT;
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS airtime_phone TEXT;
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- 3. Enable RLS on both tables
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for referrals
DROP POLICY IF EXISTS referrals_select_policy ON public.referrals;
CREATE POLICY referrals_select_policy ON public.referrals
FOR SELECT USING (
  referrer_id = (SELECT auth.uid()) OR 
  referred_id = (SELECT auth.uid()) OR 
  ((SELECT auth.role()) = 'service_role') OR 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'))
);

DROP POLICY IF EXISTS referrals_insert_policy ON public.referrals;
CREATE POLICY referrals_insert_policy ON public.referrals
FOR INSERT WITH CHECK (
  ((SELECT auth.role()) = 'service_role') OR 
  ((SELECT auth.uid()) IS NOT NULL)
);

DROP POLICY IF EXISTS referrals_update_policy ON public.referrals;
CREATE POLICY referrals_update_policy ON public.referrals
FOR UPDATE USING (
  ((SELECT auth.role()) = 'service_role') OR 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'))
);

-- 5. RLS policies for payout_requests
DROP POLICY IF EXISTS payout_requests_select ON public.payout_requests;
CREATE POLICY payout_requests_select ON public.payout_requests
FOR SELECT USING (
  user_id = (SELECT auth.uid()) OR 
  ((SELECT auth.role()) = 'service_role') OR 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'))
);

DROP POLICY IF EXISTS payout_requests_insert ON public.payout_requests;
CREATE POLICY payout_requests_insert ON public.payout_requests
FOR INSERT WITH CHECK (
  user_id = (SELECT auth.uid()) OR
  ((SELECT auth.role()) = 'service_role') OR 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'))
);

DROP POLICY IF EXISTS payout_requests_update ON public.payout_requests;
CREATE POLICY payout_requests_update ON public.payout_requests
FOR UPDATE USING (
  ((SELECT auth.role()) = 'service_role') OR 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'))
);

DROP POLICY IF EXISTS payout_requests_delete ON public.payout_requests;
CREATE POLICY payout_requests_delete ON public.payout_requests
FOR DELETE USING (
  ((SELECT auth.role()) = 'service_role') OR 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'))
);
