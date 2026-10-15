-- Migration: 0049_video_distribution_and_streaming.sql
-- Description: Dedicated Video Distribution, Video Lessons, and Watch Progress Schema
-- Purpose: Provides high-throughput, CDN-ready, low-bandwidth adaptive video storage and streaming tracking for JAMB candidates.

-- 1. Create dedicated video_lessons table
CREATE TABLE IF NOT EXISTS public.video_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INTEGER DEFAULT 0,
    video_provider VARCHAR(50) DEFAULT 'direct' CHECK (video_provider IN ('direct', 'youtube', 'vimeo', 'bunny', 'supabase_storage', 'cloudflare_stream')),
    quality_resolutions JSONB DEFAULT '{"1080p": "", "720p": "", "480p": "", "360p": ""}'::jsonb,
    low_bandwidth_url TEXT,
    file_size_bytes BIGINT DEFAULT 0,
    is_premium BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    views_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create user video progress table
CREATE TABLE IF NOT EXISTS public.user_video_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    video_id UUID REFERENCES public.video_lessons(id) ON DELETE CASCADE,
    watched_seconds INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    completion_percentage NUMERIC(5, 2) DEFAULT 0.00,
    completed BOOLEAN DEFAULT false,
    last_watched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_video_unique UNIQUE (user_id, video_id)
);

-- 3. Indexes for fast filtering and high-traffic concurrency
CREATE INDEX IF NOT EXISTS idx_video_lessons_subject_id ON public.video_lessons(subject_id);
CREATE INDEX IF NOT EXISTS idx_video_lessons_topic_id ON public.video_lessons(topic_id);
CREATE INDEX IF NOT EXISTS idx_video_lessons_is_published ON public.video_lessons(is_published);
CREATE INDEX IF NOT EXISTS idx_user_video_progress_user ON public.user_video_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_video_progress_video ON public.user_video_progress(video_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.video_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_video_progress ENABLE ROW LEVEL SECURITY;

-- 5. Policies for video_lessons
DROP POLICY IF EXISTS "Public can view published video lessons" ON public.video_lessons;
CREATE POLICY "Public can view published video lessons" 
ON public.video_lessons 
FOR SELECT 
USING (is_published = true);

DROP POLICY IF EXISTS "Admins can manage video lessons" ON public.video_lessons;
CREATE POLICY "Admins can manage video lessons" 
ON public.video_lessons 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- 6. Policies for user_video_progress
DROP POLICY IF EXISTS "Users can view and manage their own video progress" ON public.user_video_progress;
CREATE POLICY "Users can view and manage their own video progress"
ON public.user_video_progress
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 7. Storage Bucket setup for video distribution
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'video-lessons', 
    'video-lessons', 
    true, 
    524288000, -- 500MB max video chunk size
    ARRAY['video/mp4', 'video/webm', 'video/ogg', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 524288000;

-- 8. Storage bucket RLS policies for video-lessons
DROP POLICY IF EXISTS "Public Read Access for Video Lessons" ON storage.objects;
CREATE POLICY "Public Read Access for Video Lessons" 
ON storage.objects FOR SELECT 
USING (bucket_id IN ('video-lessons', 'study-materials', 'materials', 'library'));

DROP POLICY IF EXISTS "Authenticated Upload Access for Video Lessons" ON storage.objects;
CREATE POLICY "Authenticated Upload Access for Video Lessons" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id IN ('video-lessons', 'study-materials', 'materials', 'library'));
