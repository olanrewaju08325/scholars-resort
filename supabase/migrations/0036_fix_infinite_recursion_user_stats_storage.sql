-- ==============================================================================
-- SCHOLARS RESORT - MIGRATION 0036
-- FIX INFINITE RECURSION IN PROFILES RLS, ADD USER_STATS TABLE, & HARDEN STORAGE
-- ==============================================================================

-- 1. SECURITY DEFINER HELPER FOR IS_ADMIN (Bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. FIX PROFILES TABLE RLS POLICIES (NO RECURSION)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own or admin view all" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
DROP POLICY IF EXISTS "Admins select all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

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

-- 3. FIX MANUAL_PAYMENTS RLS POLICIES
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

-- 4. CREATE USER_STATS TABLE FOR BADGES, ACHIEVEMENTS & GAMIFICATION
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

-- 5. STORAGE BUCKETS & PUBLIC POLICIES
INSERT INTO storage.buckets (id, name, public) 
VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('raw_content', 'raw_content', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Clean up any conflicting storage policies on objects
DROP POLICY IF EXISTS "Public materials read" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload materials" ON storage.objects;
DROP POLICY IF EXISTS "Public raw_content read" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload raw_content" ON storage.objects;

CREATE POLICY "Public materials read" ON storage.objects FOR SELECT USING (bucket_id = 'materials');
CREATE POLICY "Auth upload materials" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'materials');

CREATE POLICY "Public raw_content read" ON storage.objects FOR SELECT USING (bucket_id = 'raw_content');
CREATE POLICY "Auth upload raw_content" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'raw_content');

-- 6. RPC TO RECORD SESSION XP AND BADGES AUTOMATICALLY
CREATE OR REPLACE FUNCTION public.record_practice_session_stats(
    p_user_id UUID,
    p_xp_gained INTEGER,
    p_questions_answered INTEGER,
    p_correct INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_stats public.user_stats%ROWTYPE;
    v_new_xp INTEGER;
    v_new_level INTEGER;
    v_badges JSONB;
BEGIN
    -- Ensure stats row exists
    INSERT INTO public.user_stats (user_id) 
    VALUES (p_user_id) 
    ON CONFLICT (user_id) DO NOTHING;

    -- Fetch current
    SELECT * INTO v_stats FROM public.user_stats WHERE user_id = p_user_id;

    v_new_xp := COALESCE(v_stats.xp, 0) + p_xp_gained;
    v_new_level := GREATEST(1, FLOOR(v_new_xp / 500) + 1);
    v_badges := COALESCE(v_stats.badges_unlocked, '[]'::jsonb);

    -- Check and award badges
    IF v_stats.quizzes_completed + 1 >= 1 AND NOT (v_badges @> '["first_quiz"]'::jsonb) THEN
        v_badges := v_badges || '["first_quiz"]'::jsonb;
    END IF;
    IF v_stats.quizzes_completed + 1 >= 10 AND NOT (v_badges @> '["quiz_master"]'::jsonb) THEN
        v_badges := v_badges || '["quiz_master"]'::jsonb;
    END IF;
    IF v_new_xp >= 1000 AND NOT (v_badges @> '["1k_club"]'::jsonb) THEN
        v_badges := v_badges || '["1k_club"]'::jsonb;
    END IF;

    UPDATE public.user_stats
    SET 
        xp = v_new_xp,
        level = v_new_level,
        quizzes_completed = COALESCE(quizzes_completed, 0) + 1,
        total_questions_answered = COALESCE(total_questions_answered, 0) + p_questions_answered,
        correct_answers = COALESCE(correct_answers, 0) + p_correct,
        accuracy_rate = CASE 
            WHEN COALESCE(total_questions_answered, 0) + p_questions_answered > 0 
            THEN ROUND((COALESCE(correct_answers, 0) + p_correct)::numeric / (COALESCE(total_questions_answered, 0) + p_questions_answered) * 100, 1)
            ELSE 0 
        END,
        badges_unlocked = v_badges,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- Also update profile XP
    UPDATE public.profiles
    SET xp = COALESCE(xp, 0) + p_xp_gained
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'new_xp', v_new_xp,
        'level', v_new_level,
        'badges', v_badges
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

SELECT 'Migration 0036 Completed Successfully! Infinite recursion fixed and user_stats created.' AS status;
