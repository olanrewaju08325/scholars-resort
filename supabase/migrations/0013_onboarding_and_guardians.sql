-- V13: Onboarding and Guardian Architecture

-- 1. Profile Onboarding Fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_university TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_study_goal_minutes INTEGER DEFAULT 60;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_score INTEGER;

-- 2. Guardian Links Table
CREATE TABLE IF NOT EXISTS public.guardian_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    guardian_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    invitation_code TEXT UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.guardian_links ENABLE ROW LEVEL SECURITY;

-- Students can see and manage links they generated
CREATE POLICY "Students can manage their own links" ON public.guardian_links 
    FOR ALL USING (auth.uid() = student_id);

-- Guardians can see links where they are the guardian_id
CREATE POLICY "Guardians can see their links" ON public.guardian_links 
    FOR SELECT USING (auth.uid() = guardian_id);

-- Anyone authenticated can update a link (needed for a guardian to claim a pending link)
-- We will enforce the exact logic in the app layer (or a secure RPC function)
CREATE POLICY "Authenticated users can update links" ON public.guardian_links 
    FOR UPDATE USING (auth.role() = 'authenticated');
