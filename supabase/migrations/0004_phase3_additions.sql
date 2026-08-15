-- V3 Additions for Phase 3: Materials, Guardians, Tournaments, and Gamification

-- 1. UPDATE PROFILES FOR DEVICES & GAMIFICATION
DO $$ 
BEGIN
    -- Add columns only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'device_id') THEN
        ALTER TABLE public.profiles ADD COLUMN device_id TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'device_resets_used') THEN
        ALTER TABLE public.profiles ADD COLUMN device_resets_used INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'last_device_reset') THEN
        ALTER TABLE public.profiles ADD COLUMN last_device_reset TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'pending_device_reset') THEN
        ALTER TABLE public.profiles ADD COLUMN pending_device_reset BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'streak_recovery_used_this_month') THEN
        ALTER TABLE public.profiles ADD COLUMN streak_recovery_used_this_month BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'last_study_action') THEN
        ALTER TABLE public.profiles ADD COLUMN last_study_action TIMESTAMP;
    END IF;
END $$;

-- 2. MATERIALS / TEXTBOOKS TABLE
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    visibility BOOLEAN DEFAULT false, -- true = published, false = draft
    is_premium BOOLEAN DEFAULT false,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage materials." ON public.materials;
DROP POLICY IF EXISTS "Students can view published materials." ON public.materials;

-- Admins can do anything
CREATE POLICY "Admins can manage materials." ON public.materials 
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Students can only view published materials
CREATE POLICY "Students can view published materials." ON public.materials 
FOR SELECT USING (
  visibility = true
);

-- 3. GUARDIAN LINKS (Strictly 1-to-1)
-- Drop existing table if it exists to recreate with new structure
DROP TABLE IF EXISTS public.guardian_links CASCADE;

CREATE TABLE public.guardian_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE, -- Enforces 1 guardian per student max
    guardian_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    link_code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT false,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.guardian_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage guardian links." ON public.guardian_links;
DROP POLICY IF EXISTS "Guardians can view their links." ON public.guardian_links;
DROP POLICY IF EXISTS "Students can view their links." ON public.guardian_links;
DROP POLICY IF EXISTS "Students can generate links." ON public.guardian_links;

-- Create policies
CREATE POLICY "Admins can manage guardian links." ON public.guardian_links 
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Guardians can view their links." ON public.guardian_links 
FOR SELECT USING (guardian_id = auth.uid());

CREATE POLICY "Students can view their links." ON public.guardian_links 
FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students can generate links." ON public.guardian_links
FOR INSERT WITH CHECK (student_id = auth.uid());

-- 4. TOURNAMENTS
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    entry_fee DECIMAL DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
    max_participants INTEGER,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.tournament_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    completed_at TIMESTAMP,
    registered_at TIMESTAMP DEFAULT timezone('utc', now()),
    UNIQUE(tournament_id, student_id)
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view tournaments." ON public.tournaments;
DROP POLICY IF EXISTS "Admins manage tournaments." ON public.tournaments;
DROP POLICY IF EXISTS "Anyone can view participants." ON public.tournament_participants;
DROP POLICY IF EXISTS "Students can register themselves." ON public.tournament_participants;

-- Create policies
CREATE POLICY "Anyone can view tournaments." ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Admins manage tournaments." ON public.tournaments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Anyone can view participants." ON public.tournament_participants FOR SELECT USING (true);
CREATE POLICY "Students can register themselves." ON public.tournament_participants FOR INSERT WITH CHECK (
  student_id = auth.uid()
);

-- 5. STORAGE BUCKET FOR MATERIALS
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', false) ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Admin full access to materials bucket" ON storage.objects;
DROP POLICY IF EXISTS "Students can read published materials" ON storage.objects;

-- Create storage policies
CREATE POLICY "Admin full access to materials bucket" ON storage.objects
FOR ALL USING (
  bucket_id = 'materials' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Students can read published materials" ON storage.objects
FOR SELECT USING (
  bucket_id = 'materials' AND
  EXISTS (SELECT 1 FROM public.materials WHERE file_path = name AND visibility = true)
);