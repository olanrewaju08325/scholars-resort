-- V5 Study Streaks additions

ALTER TABLE public.profiles
ADD COLUMN streak_freezes INTEGER DEFAULT 0,
ADD COLUMN last_study_date DATE,
ADD COLUMN longest_streak INTEGER DEFAULT 0;

CREATE TABLE public.study_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'exam', 'practice', 'library'
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

-- RLS
ALTER TABLE public.study_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own study logs" ON public.study_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own study logs" ON public.study_logs FOR SELECT USING (auth.uid() = user_id);
