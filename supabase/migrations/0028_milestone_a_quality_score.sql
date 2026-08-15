-- Milestone A: AI Content Studio Perfection
-- Run this in your Supabase SQL Editor

-- 1. Add Quality Score and Draft Status to Questions Table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'questions' 
                   AND column_name = 'quality_score') THEN
        ALTER TABLE public.questions 
        ADD COLUMN quality_score INTEGER DEFAULT 100,
        ADD COLUMN is_draft BOOLEAN DEFAULT false,
        ADD COLUMN context_type TEXT DEFAULT 'JAMB'; -- e.g., JAMB, WAEC, POST-UTME, Textbook
    END IF;
END $$;

-- 2. Add Math OCR & AI Healing tracking to Ingestion Jobs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'content_ingestion_jobs' 
                   AND column_name = 'math_ocr_used') THEN
        ALTER TABLE public.content_ingestion_jobs 
        ADD COLUMN math_ocr_used BOOLEAN DEFAULT false,
        ADD COLUMN context_detected TEXT,
        ADD COLUMN rejected_count INTEGER DEFAULT 0;
    END IF;
END $$;
