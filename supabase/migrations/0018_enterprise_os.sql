-- 0018_enterprise_os.sql
-- Enterprise Operating System Upgrades

-- 1. SMTP & Communication Center Logs
CREATE TABLE IF NOT EXISTS public.communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email VARCHAR(255) NOT NULL,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    email_type VARCHAR(100) NOT NULL,
    subject TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT timezone('utc', now()),
    sent_at TIMESTAMP
);

ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view communication logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Users can view own communication logs" ON public.communication_logs;

CREATE POLICY "Admins can view communication logs" ON public.communication_logs FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can view own communication logs" ON public.communication_logs FOR SELECT USING (auth.uid() = recipient_id);

-- 4. Study Plans (AI Generated)
CREATE TABLE IF NOT EXISTS public.study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    target_score INT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage own study plans" ON public.study_plans;

CREATE POLICY "Users can manage own study plans" ON public.study_plans FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.study_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES public.study_plans(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    scheduled_date DATE NOT NULL,
    duration_minutes INT DEFAULT 60,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.study_plan_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage own study plan items" ON public.study_plan_items;

CREATE POLICY "Users can manage own study plan items" ON public.study_plan_items FOR ALL USING (
    plan_id IN (SELECT id FROM public.study_plans WHERE user_id = auth.uid())
);

-- 5. Expand Tournaments (Adding enterprise fields)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'tournaments' 
                   AND column_name = 'prize_pool') THEN
        ALTER TABLE public.tournaments ADD COLUMN prize_pool TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'tournaments' 
                   AND column_name = 'rules') THEN
        ALTER TABLE public.tournaments ADD COLUMN rules TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'tournaments' 
                   AND column_name = 'max_participants') THEN
        ALTER TABLE public.tournaments ADD COLUMN max_participants INT DEFAULT 1000;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'tournaments' 
                   AND column_name = 'is_premium_only') THEN
        ALTER TABLE public.tournaments ADD COLUMN is_premium_only BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'tournaments' 
                   AND column_name = 'difficulty') THEN
        ALTER TABLE public.tournaments ADD COLUMN difficulty VARCHAR(50) DEFAULT 'mixed';
    END IF;
END $$;

-- 6. Tournament Participants - Drop existing table and recreate with new structure
DROP TABLE IF EXISTS public.tournament_participants CASCADE;

CREATE TABLE public.tournament_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    registered_at TIMESTAMP DEFAULT timezone('utc', now()),
    score INT DEFAULT 0,
    time_spent_seconds INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'registered' CHECK (status IN ('registered', 'in_progress', 'completed', 'disqualified')),
    rank INT,
    UNIQUE(tournament_id, user_id)
);

ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view participants." ON public.tournament_participants;
DROP POLICY IF EXISTS "Students can register themselves." ON public.tournament_participants;
DROP POLICY IF EXISTS "Admins can manage participants" ON public.tournament_participants;
DROP POLICY IF EXISTS "Users can view participants" ON public.tournament_participants;
DROP POLICY IF EXISTS "Users can register" ON public.tournament_participants;

CREATE POLICY "Users can view participants" ON public.tournament_participants FOR SELECT USING (true);
CREATE POLICY "Users can register" ON public.tournament_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage participants" ON public.tournament_participants FOR ALL USING (public.is_admin());

-- 7. Admin AI Settings
CREATE TABLE IF NOT EXISTS public.admin_ai_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature VARCHAR(100) UNIQUE NOT NULL,
    system_prompt TEXT NOT NULL,
    model VARCHAR(50) DEFAULT 'llama-3.3-70b-versatile',
    temperature FLOAT DEFAULT 0.7,
    updated_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.admin_ai_prompts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage prompts" ON public.admin_ai_prompts;

CREATE POLICY "Admins can manage prompts" ON public.admin_ai_prompts FOR ALL USING (public.is_admin());

-- Insert default prompts
INSERT INTO public.admin_ai_prompts (feature, system_prompt) VALUES 
('tutor_chat', 'You are an expert JAMB Tutor for Nigerian students. Explain concepts clearly.'),
('question_validator', 'You are a QA Engineer. Analyze the provided JAMB question for accuracy, grammar, and difficulty.'),
('study_planner', 'You are an academic advisor. Generate a JSON study schedule based on the user''s weaknesses and time available.')
ON CONFLICT (feature) DO NOTHING;

-- Force cache reload
NOTIFY pgrst, 'reload schema';