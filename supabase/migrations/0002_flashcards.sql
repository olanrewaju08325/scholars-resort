CREATE TABLE public.flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view global flashcards or their own" ON public.flashcards FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Users can insert their own flashcards" ON public.flashcards FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own flashcards" ON public.flashcards FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own flashcards" ON public.flashcards FOR DELETE USING (user_id = auth.uid());

-- Optional: Insert some global dummy flashcards
INSERT INTO public.flashcards (user_id, front_text, back_text) VALUES 
(NULL, 'What is the powerhouse of the cell?', 'Mitochondria'),
(NULL, 'What is Newton''s Third Law?', 'For every action, there is an equal and opposite reaction.');
