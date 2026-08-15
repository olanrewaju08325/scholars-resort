-- Part 19: Business Logic Expansion
-- Run this entire file in your Supabase SQL Editor

-- =============================================
-- 1. Discount Codes
-- =============================================
CREATE TABLE IF NOT EXISTS public.discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'flat')),
    discount_value NUMERIC NOT NULL,
    max_uses INTEGER DEFAULT 100,
    times_used INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 2. Referrals
-- =============================================
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    converted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 3. Guardian Messages (standalone inbox)
-- =============================================
CREATE TABLE IF NOT EXISTS public.guardian_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    guardian_email TEXT NOT NULL,
    guardian_phone TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 4. Study Goals
-- =============================================
CREATE TABLE IF NOT EXISTS public.study_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    target_score INTEGER DEFAULT 300,
    exam_date DATE,
    daily_study_hours INTEGER DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 5. AI Prompt Store (for AI Prompt Studio)
-- =============================================
CREATE TABLE IF NOT EXISTS public.admin_ai_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name TEXT UNIQUE NOT NULL,
    system_prompt TEXT NOT NULL,
    model TEXT DEFAULT 'llama-3.1-8b-instant',
    temperature NUMERIC DEFAULT 0.7,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial prompts
INSERT INTO public.admin_ai_prompts (feature_name, system_prompt, model) VALUES
('flashcard_generator', 'You are an expert JAMB tutor. Generate exactly 5 concise, factual flashcards based on the given topic. Format your response as a JSON array: [{"front": "question", "back": "answer"}]. Keep answers under 20 words.', 'llama-3.1-8b-instant'),
('study_plan_generator', 'You are an expert JAMB study coach. Create a structured, realistic 7-day study plan for a student based on their weak subjects and available study hours per day. Format as a clear weekly schedule.', 'llama-3.1-70b-versatile'),
('question_explainer', 'You are an expert JAMB tutor. Explain the correct answer to the given multiple-choice question in simple, clear language. Break down the reasoning step-by-step. Maximum 150 words.', 'llama-3.1-8b-instant'),
('ai_tutor_chat', 'You are Scholar AI, an expert JAMB tutor on the Scholars Resort platform. Be encouraging, precise, and student-friendly. Focus on JAMB-relevant topics. Keep responses concise and engaging.', 'llama-3.1-70b-versatile'),
('weekly_challenge_generator', 'You are a JAMB exam specialist. Generate one high-quality, challenging JAMB-style multiple choice question for the given subject. Format: {"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A", "explanation": "..."}', 'llama-3.1-8b-instant'),
('burnout_detector', 'You are a student wellness advisor. Based on the student study data provided, assess the student burnout risk (Low/Medium/High) and provide 3 specific, actionable suggestions to improve their study-life balance. Keep it encouraging.', 'llama-3.1-8b-instant')
ON CONFLICT (feature_name) DO NOTHING;

-- =============================================
-- 6. Device Sessions (for Telemetry)
-- =============================================
CREATE TABLE IF NOT EXISTS public.device_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_info JSONB DEFAULT '{}',
    last_active TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 7. Weekly Challenges
-- =============================================
CREATE TABLE IF NOT EXISTS public.weekly_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    question_data JSONB NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.weekly_challenge_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID REFERENCES public.weekly_challenges(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    selected_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(challenge_id, user_id)
);

-- =============================================
-- 8. XP Transactions (detailed XP log)
-- =============================================
CREATE TABLE IF NOT EXISTS public.xp_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage discount codes" ON public.discount_codes;
CREATE POLICY "Admins can manage discount codes" ON public.discount_codes
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Anyone can view discount codes" ON public.discount_codes;
CREATE POLICY "Anyone can view discount codes" ON public.discount_codes FOR SELECT USING (true);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own referrals" ON public.referrals;
CREATE POLICY "Users can view their own referrals" ON public.referrals
    FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
DROP POLICY IF EXISTS "Users can create referrals" ON public.referrals;
CREATE POLICY "Users can create referrals" ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referred_id);
DROP POLICY IF EXISTS "Admins can view all referrals" ON public.referrals;
CREATE POLICY "Admins can view all referrals" ON public.referrals
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.guardian_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can manage their own guardian messages" ON public.guardian_messages;
CREATE POLICY "Students can manage their own guardian messages" ON public.guardian_messages
    FOR ALL USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "Admins can manage all guardian messages" ON public.guardian_messages;
CREATE POLICY "Admins can manage all guardian messages" ON public.guardian_messages
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.study_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own study goals" ON public.study_goals;
CREATE POLICY "Users can manage their own study goals" ON public.study_goals
    FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.admin_ai_prompts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage AI prompts" ON public.admin_ai_prompts;
CREATE POLICY "Admins can manage AI prompts" ON public.admin_ai_prompts
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own sessions" ON public.device_sessions;
CREATE POLICY "Users manage own sessions" ON public.device_sessions FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all device sessions" ON public.device_sessions;
CREATE POLICY "Admins can view all device sessions" ON public.device_sessions
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active challenges" ON public.weekly_challenges;
CREATE POLICY "Anyone can view active challenges" ON public.weekly_challenges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage challenges" ON public.weekly_challenges;
CREATE POLICY "Admins can manage challenges" ON public.weekly_challenges
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.weekly_challenge_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own challenge submissions" ON public.weekly_challenge_submissions;
CREATE POLICY "Users manage own challenge submissions" ON public.weekly_challenge_submissions
    FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own XP transactions" ON public.xp_transactions;
CREATE POLICY "Users can view own XP transactions" ON public.xp_transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "System can insert XP transactions" ON public.xp_transactions;
CREATE POLICY "System can insert XP transactions" ON public.xp_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- bookmarks (safety net)
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookmarks' AND policyname = 'Users can manage their own bookmarks') THEN
        CREATE POLICY "Users can manage their own bookmarks" ON public.bookmarks
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user_id ON public.device_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_last_active ON public.device_sessions(last_active);
CREATE INDEX IF NOT EXISTS idx_weekly_challenges_week ON public.weekly_challenges(week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON public.xp_transactions(user_id);
