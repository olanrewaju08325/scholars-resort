-- Part 23: Support Attachments & Storage
-- Run this in your Supabase SQL Editor

-- 1. Add attachment_url to ticket_replies
ALTER TABLE public.ticket_replies
    ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 2. Create the support-attachments storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies for support-attachments
-- Admins can read all attachments
CREATE POLICY "Admins can view all support attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'support-attachments' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')));

-- Users can view their own ticket attachments
CREATE POLICY "Users can view own support attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'support-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can upload to their own folder in support-attachments
CREATE POLICY "Users can upload support attachments"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'support-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
