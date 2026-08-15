-- ==============================================================================
-- SCHOLARS RESORT - PRODUCTION MASTER DATABASE MIGRATION & FIXES
-- Copy and paste this ENTIRE script directly into your Supabase SQL Editor.
-- ==============================================================================

-- 0. SECURITY DEFINER HELPER FUNCTION (Prevents Infinite Recursion in RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1. BACKFILL MISSING PROFILES FOR ALL EXISTING AUTH USERS
INSERT INTO public.profiles (id, full_name, email, role, has_paid)
SELECT 
    id, 
    COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1), 'Student'), 
    COALESCE(email, id::text || '@scholarsresort.com'), 
    'student', 
    false 
FROM auth.users 
ON CONFLICT (id) DO NOTHING;

-- 2. HARDEN AUTOMATIC NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone_number, role, has_paid)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Student'), 
    COALESCE(new.email, new.id::text || '@scholarsresort.com'), 
    new.raw_user_meta_data->>'phone_number', 
    'student', 
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. FIX MANUAL_PAYMENTS FOREIGN KEY & COLUMNS
DO $$ 
BEGIN
    -- Drop old restrictive foreign key constraint if exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'manual_payments_user_id_fkey') THEN
        ALTER TABLE public.manual_payments DROP CONSTRAINT manual_payments_user_id_fkey;
    END IF;
END $$;

-- Add user_id referencing auth.users directly with cascade
ALTER TABLE public.manual_payments 
  ADD CONSTRAINT manual_payments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add missing columns to manual_payments if they don't exist
ALTER TABLE public.manual_payments 
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

-- 4. ENABLE RLS & DEFINE POLICIES FOR MANUAL PAYMENTS
ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own payments" ON public.manual_payments;
CREATE POLICY "Users can insert own payments" 
ON public.manual_payments FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own payments" ON public.manual_payments;
CREATE POLICY "Users can view own payments" 
ON public.manual_payments FOR SELECT 
TO authenticated 
USING (
  auth.uid() = user_id 
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Admins can manage payments" ON public.manual_payments;
CREATE POLICY "Admins can manage payments" 
ON public.manual_payments FOR ALL 
TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5. ENABLE RLS & DEFINE POLICIES FOR PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own or admin view all" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
DROP POLICY IF EXISTS "Admins select all profiles" ON public.profiles;

CREATE POLICY "Users can view own or admin view all" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (
  auth.uid() = id 
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- 6. CONTENT INGESTION JOBS TABLE & POLICIES
CREATE TABLE IF NOT EXISTS public.content_ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    total_questions_found INTEGER DEFAULT 0,
    rejected_count INTEGER DEFAULT 0,
    extracted_data JSONB,
    preview_csv TEXT,
    context_detected TEXT,
    math_ocr_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.content_ingestion_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage ingestion jobs" ON public.content_ingestion_jobs;
CREATE POLICY "Admins can manage ingestion jobs"
ON public.content_ingestion_jobs FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. USER_STATS TABLE FOR BADGES & GAMIFICATION
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    xp INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    quizzes_completed INTEGER DEFAULT 0,
    duels_won INTEGER DEFAULT 0,
    total_questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    accuracy_rate NUMERIC DEFAULT 0,
    badges_unlocked JSONB DEFAULT '[]'::jsonb,
    weak_topics JSONB DEFAULT '[]'::jsonb,
    daily_data_used_mb NUMERIC DEFAULT 0,
    last_active_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own stats" ON public.user_stats;
CREATE POLICY "Users can view own stats"
ON public.user_stats FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own stats" ON public.user_stats;
CREATE POLICY "Users can update own stats"
ON public.user_stats FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 8. STORAGE BUCKETS SETUP (materials and raw_content)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('raw_content', 'raw_content', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for materials (receipts, study files)
DROP POLICY IF EXISTS "Public materials read" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload materials" ON storage.objects;
CREATE POLICY "Public materials read" ON storage.objects FOR SELECT USING (bucket_id = 'materials');
CREATE POLICY "Auth upload materials" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'materials');

-- Storage policies for raw_content (PDF ingestion uploads)
DROP POLICY IF EXISTS "Public raw_content read" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload raw_content" ON storage.objects;
CREATE POLICY "Public raw_content read" ON storage.objects FOR SELECT USING (bucket_id = 'raw_content');
CREATE POLICY "Auth upload raw_content" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'raw_content');

-- 9. HELPER RPC FOR INCREMENT XP
CREATE OR REPLACE FUNCTION public.increment_xp(p_user_id uuid, p_amount integer)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + p_amount
  WHERE id = p_user_id;
  
  INSERT INTO public.user_stats (user_id, xp) 
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) 
  DO UPDATE SET xp = COALESCE(public.user_stats.xp, 0) + p_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- SUCCESS CONFIRMATION QUERY
SELECT 'Scholars Resort Master Production Migration Completed Successfully!' AS status;
