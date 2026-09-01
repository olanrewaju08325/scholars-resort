-- Migration 0042: Subtopics, Source Metadata, and Academic Taxonomy Expansion
-- Safe, additive migration: Adds subtopics table and source metadata columns to questions.

-- 1. Create subtopics table
CREATE TABLE IF NOT EXISTS public.subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on topic_id for fast subtopic lookup
CREATE INDEX IF NOT EXISTS idx_subtopics_topic_id ON public.subtopics(topic_id);

-- Enable RLS on subtopics
ALTER TABLE public.subtopics ENABLE ROW LEVEL SECURITY;

-- Select policy: Anyone can read subtopics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subtopics' AND policyname = 'subtopics_select_policy'
  ) THEN
    CREATE POLICY "subtopics_select_policy" ON public.subtopics FOR SELECT USING (true);
  END IF;
END $$;

-- Admin policy for subtopics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subtopics' AND policyname = 'subtopics_admin_policy'
  ) THEN
    CREATE POLICY "subtopics_admin_policy" ON public.subtopics FOR ALL USING (
      (SELECT public.is_admin())
    ) WITH CHECK (
      (SELECT public.is_admin())
    );
  END IF;
END $$;

-- 2. Add columns to questions for subtopics and source provenance
ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS subtopic_id UUID REFERENCES public.subtopics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'jamb_past',
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS source_year INTEGER;

-- Create index on questions.subtopic_id and source_type
CREATE INDEX IF NOT EXISTS idx_questions_subtopic_id ON public.questions(subtopic_id);
CREATE INDEX IF NOT EXISTS idx_questions_source_type ON public.questions(source_type);
