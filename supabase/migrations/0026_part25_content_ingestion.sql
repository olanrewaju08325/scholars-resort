-- Phase 25: AI Content Ingestion Engine Schema
-- Run this in your Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════════
-- 1. STORAGE BUCKET FOR RAW CONTENT
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('raw_content', 'raw_content', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for raw_content bucket (Admins only)
CREATE POLICY "Admins can manage raw content" 
ON storage.objects FOR ALL 
USING (bucket_id = 'raw_content' AND public.is_admin())
WITH CHECK (bucket_id = 'raw_content' AND public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- 2. CONTENT INGESTION JOBS TABLE
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.content_ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, extracting, ai_processing, review_ready, completed, failed
    progress INTEGER DEFAULT 0,
    total_questions_found INTEGER DEFAULT 0,
    extracted_data JSONB, -- The raw output from AI
    preview_csv TEXT,     -- The generated CSV string
    error_log TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

ALTER TABLE public.content_ingestion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ingestion jobs"
    ON public.content_ingestion_jobs FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- 3. ENSURE PROFILES HAVE SUBJECT LOCK-IN COLUMNS
-- ═══════════════════════════════════════════════════════════════════
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'utme_subjects') THEN
        ALTER TABLE public.profiles ADD COLUMN utme_subjects JSONB DEFAULT '[]';
    END IF;
END $$;
