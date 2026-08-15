-- V12: Academic Engine V2 Updates (Bookmarks, Library, Profiles)

-- 1. Extend profiles to include readiness score and target course
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_course TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS readiness_score INTEGER DEFAULT 0;

-- 2. Create Bookmarks Table
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    note TEXT,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own bookmarks" ON public.bookmarks 
    FOR ALL USING (auth.uid() = user_id);

-- 3. Create Library Materials Table
CREATE TABLE IF NOT EXISTS public.library_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    file_url TEXT NOT NULL,
    material_type VARCHAR(50) DEFAULT 'pdf' CHECK (material_type IN ('pdf', 'video', 'past_questions')),
    is_premium BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.library_materials ENABLE ROW LEVEL SECURITY;
-- Everyone can view active library materials
CREATE POLICY "Users can view active library materials" ON public.library_materials 
    FOR SELECT USING (is_active = true);
-- Admins can manage library materials
CREATE POLICY "Admins can manage library materials" ON public.library_materials 
    FOR ALL USING (public.is_admin());

-- Dummy data for Library Materials
INSERT INTO public.library_materials (title, description, file_url, is_premium) VALUES 
('Physics Comprehensive Guide', 'Complete notes for UTME Physics.', 'https://example.com/physics.pdf', true),
('Mathematics Formulas Cheat Sheet', 'All math formulas in one place.', 'https://example.com/math.pdf', false)
ON CONFLICT DO NOTHING;
