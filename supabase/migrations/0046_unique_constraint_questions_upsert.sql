-- ==============================================================================
-- MIGRATION 0046: Add Missing Unique Constraint for Question UPSERT & PostgREST
-- Fixes: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- ==============================================================================

-- 1. Ensure 'year' column exists on questions table with default 0
ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS year INTEGER DEFAULT 0;

-- 2. Normalize NULL years to 0 so composite unique constraint can index consistently
UPDATE public.questions 
SET year = 0 
WHERE year IS NULL;

-- 3. De-duplicate existing questions before applying the unique constraint
-- Keeps the newest record (highest ID) for each (subject_id, question_text, year) tuple
DELETE FROM public.questions a
USING public.questions b
WHERE a.id < b.id
  AND a.subject_id = b.subject_id
  AND a.question_text = b.question_text
  AND COALESCE(a.year, 0) = COALESCE(b.year, 0);

-- 4. Safely drop any conflicting partial indexes or prior constraint attempts
ALTER TABLE public.questions 
  DROP CONSTRAINT IF EXISTS uq_questions_subject_text_year;
DROP INDEX IF EXISTS idx_questions_subject_text_year;

-- 5. Create explicit UNIQUE constraint on (subject_id, question_text, year)
-- This exactly satisfies PostgREST ?on_conflict=subject_id,question_text,year
ALTER TABLE public.questions
  ADD CONSTRAINT uq_questions_subject_text_year
  UNIQUE (subject_id, question_text, year);

-- 6. Add performance index for lookup and sorting
CREATE INDEX IF NOT EXISTS idx_questions_subject_year_perf
  ON public.questions(subject_id, year, is_active);

-- 7. Audit notification
COMMENT ON CONSTRAINT uq_questions_subject_text_year ON public.questions IS 
  'Authoritative composite uniqueness constraint allowing zero-error bulk upserting of past UTME questions';
