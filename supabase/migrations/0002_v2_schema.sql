-- V2 Schema Additions for Scholars Resort

-- GUARDIAN LINKS TABLE
-- Maps a parent/guardian user account to a student's profile account
CREATE TABLE IF NOT EXISTS public.guardian_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guardian_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT timezone('utc', now()),
    UNIQUE(guardian_id, student_id)
);

-- Enable RLS for Guardian Links (with checks to avoid duplicate policies)
ALTER TABLE public.guardian_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Guardians can view their own links" ON public.guardian_links;
DROP POLICY IF EXISTS "Students can view and delete their own links" ON public.guardian_links;

-- Create policies
CREATE POLICY "Guardians can view their own links" ON public.guardian_links 
    FOR SELECT USING (auth.uid() = guardian_id);
    
CREATE POLICY "Students can view and delete their own links" ON public.guardian_links 
    FOR ALL USING (auth.uid() = student_id);

-- FLASHCARDS TABLE
-- Stores curated flip-card content for topics
CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP DEFAULT timezone('utc', now())
);

-- DUMMY DATA FOR FLASHCARDS (with proper UUID casting)
INSERT INTO public.flashcards (subject_id, topic_id, front_text, back_text) 
SELECT * FROM (VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID, 'f1eebc99-9c0b-4ef8-bb6d-6bb9bd380f11'::UUID, 'What is the quadratic formula?', 'x = [-b ± √(b² - 4ac)] / 2a'),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22'::UUID, 'f2eebc99-9c0b-4ef8-bb6d-6bb9bd380f22'::UUID, 'Define "Noun"', 'A word that represents a person, place, thing, or idea.')
) AS v(subject_id, topic_id, front_text, back_text)
WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards 
    WHERE subject_id = v.subject_id AND topic_id = v.topic_id AND front_text = v.front_text
);

-- DEVICE LOCK SYSTEM
-- Adding tracking columns to profiles to restrict access to a single device (1 reset per month)
DO $$ 
BEGIN
    -- Check if column exists before adding
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'device_uuid') THEN
        ALTER TABLE public.profiles ADD COLUMN device_uuid UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'device_reset_count') THEN
        ALTER TABLE public.profiles ADD COLUMN device_reset_count INT DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'last_device_reset') THEN
        ALTER TABLE public.profiles ADD COLUMN last_device_reset TIMESTAMP;
    END IF;
END $$;