-- Part 23: Final Production Schema Additions
-- Run this in your Supabase SQL Editor

-- 1. Add missing badge types (streak_30, exam_10, exam_50, high_scorer)
-- Use a DO block to check and insert only if they don't exist
DO $$
BEGIN
    -- Insert each badge individually if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM public.badges WHERE name = 'Monthly Scholar') THEN
        INSERT INTO public.badges (name, description, icon, requirement_type) 
        VALUES ('Monthly Scholar', 'Maintained a 30-day study streak!', 'Calendar', 'streak_30');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.badges WHERE name = '10x Champion') THEN
        INSERT INTO public.badges (name, description, icon, requirement_type) 
        VALUES ('10x Champion', 'Completed 10 or more exam sessions.', 'Award', 'exam_10');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.badges WHERE name = 'JAMB Veteran') THEN
        INSERT INTO public.badges (name, description, icon, requirement_type) 
        VALUES ('JAMB Veteran', 'Completed 50 or more exam sessions.', 'Shield', 'exam_50');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.badges WHERE name = 'High Achiever') THEN
        INSERT INTO public.badges (name, description, icon, requirement_type) 
        VALUES ('High Achiever', 'Scored 90% or above on an exam.', 'Star', 'high_scorer');
    END IF;
END $$;

-- 2. Ensure activity_logs table exists for payment tracking
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can read all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can log their own actions" ON public.activity_logs;

CREATE POLICY "Admins can read all activity logs"
    ON public.activity_logs FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Users can log their own actions"
    ON public.activity_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 3. Add payment_method and reference columns to manual_payments if missing
DO $$ 
BEGIN
    -- Check if table exists first
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'manual_payments') THEN
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_schema = 'public' 
                       AND table_name = 'manual_payments' 
                       AND column_name = 'payment_method') THEN
            ALTER TABLE public.manual_payments ADD COLUMN payment_method TEXT DEFAULT 'manual';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_schema = 'public' 
                       AND table_name = 'manual_payments' 
                       AND column_name = 'reference') THEN
            ALTER TABLE public.manual_payments ADD COLUMN reference TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_schema = 'public' 
                       AND table_name = 'manual_payments' 
                       AND column_name = 'approved_at') THEN
            ALTER TABLE public.manual_payments ADD COLUMN approved_at TIMESTAMPTZ;
        END IF;
    END IF;
END $$;

-- 4. Ensure subscriptions table has correct columns
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'premium',
    status TEXT NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view own subscription"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Service role can manage subscriptions"
    ON public.subscriptions FOR ALL
    USING (public.is_admin());

-- 5. Add study_goals table for personal tracking
CREATE TABLE IF NOT EXISTS public.study_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_date DATE,
    goal_type TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'monthly', 'semester'
    target_hours NUMERIC(5,2),
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.study_goals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users manage own goals" ON public.study_goals;

CREATE POLICY "Users manage own goals" ON public.study_goals FOR ALL USING (auth.uid() = user_id);

-- 6. Index on activity_logs for fast admin queries
-- Check if columns exist before creating indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'activity_logs' 
               AND column_name = 'user_id') THEN
        CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id, created_at DESC);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'activity_logs' 
               AND column_name = 'action') THEN
        CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action, created_at DESC);
    END IF;
END $$;

-- Force cache reload
NOTIFY pgrst, 'reload schema';