-- V14: Gamification Engine

-- 1. Profiles Update for Streaks
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_study_date DATE;

-- 2. Badges Table
CREATE TABLE IF NOT EXISTS public.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL, -- e.g., 'Trophy', 'Zap', 'Flame'
    requirement_type TEXT NOT NULL, -- e.g., 'first_exam', 'streak_7', 'speed_demon', 'flawless'
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are viewable by everyone" ON public.badges FOR SELECT USING (true);

-- 3. User Badges Table
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT timezone('utc', now()),
    UNIQUE(student_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can see their own badges" ON public.user_badges FOR SELECT USING (auth.uid() = student_id);
-- In a real production app with Edge Functions, inserts would be restricted to service roles. 
-- For our prototype, we allow authenticated users to claim badges.
CREATE POLICY "Students can claim badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Insert Default Badges
INSERT INTO public.badges (name, description, icon, requirement_type)
VALUES 
  ('First Steps', 'Completed your first CBT Exam.', 'Trophy', 'first_exam'),
  ('7-Day Scholar', 'Maintained a 7-day study streak.', 'Flame', 'streak_7'),
  ('Speed Demon', 'Finished an exam in under 50% of the allocated time with >70% score.', 'Zap', 'speed_demon'),
  ('Flawless Victory', 'Scored 100% on any practice drill or exam.', 'Star', 'flawless')
ON CONFLICT DO NOTHING;
