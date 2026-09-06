-- Migration 0045: Complete fix for tournaments, library_materials, weekly challenges, and study logs
-- Run this in your Supabase SQL Editor if you want all tables and columns fully aligned.

-- 1. Library Materials table: ensure 'type' and 'material_type' both exist
CREATE TABLE IF NOT EXISTS public.library_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    subject TEXT,
    topic TEXT,
    type VARCHAR(50) DEFAULT 'pdf',
    material_type VARCHAR(50) DEFAULT 'pdf',
    file_url TEXT,
    file_path TEXT,
    file_size BIGINT,
    author TEXT,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.library_materials 
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'pdf',
ADD COLUMN IF NOT EXISTS material_type VARCHAR(50) DEFAULT 'pdf';

-- 2. Tournaments: ensure all columns and RLS exist
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    rules TEXT,
    subject_filter TEXT DEFAULT '',
    question_count INTEGER DEFAULT 40,
    duration_minutes INTEGER DEFAULT 120,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    registration_deadline TIMESTAMPTZ,
    max_participants INTEGER DEFAULT 500,
    prize_description TEXT,
    cash_prize NUMERIC DEFAULT 0,
    entry_fee NUMERIC DEFAULT 0,
    coin_reward INTEGER DEFAULT 0,
    xp_reward INTEGER DEFAULT 0,
    sponsor TEXT,
    scholarship_description TEXT,
    is_private BOOLEAN DEFAULT false,
    invite_code TEXT,
    status VARCHAR(50) DEFAULT 'upcoming',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS coin_reward INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS xp_reward INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS question_count INTEGER DEFAULT 40,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 120,
ADD COLUMN IF NOT EXISTS subject_filter TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS prize_description TEXT,
ADD COLUMN IF NOT EXISTS cash_prize NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS entry_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS sponsor TEXT,
ADD COLUMN IF NOT EXISTS scholarship_description TEXT,
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS invite_code TEXT,
ADD COLUMN IF NOT EXISTS rules TEXT;

-- Enable RLS for tournaments with permissive access
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view tournaments." ON public.tournaments;
CREATE POLICY "Anyone can view tournaments." ON public.tournaments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage tournaments." ON public.tournaments;
CREATE POLICY "Admins manage tournaments." ON public.tournaments FOR ALL USING (
  auth.role() = 'authenticated' OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin'))
);

-- 3. Tournament Participants
CREATE TABLE IF NOT EXISTS public.tournament_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    score NUMERIC DEFAULT 0,
    time_taken_seconds INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tournament_id, user_id)
);

ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view tournament participants." ON public.tournament_participants;
CREATE POLICY "Anyone can view tournament participants." ON public.tournament_participants FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can register for tournaments." ON public.tournament_participants;
CREATE POLICY "Users can register for tournaments." ON public.tournament_participants FOR ALL USING (
  auth.role() = 'authenticated'
);

-- 4. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
