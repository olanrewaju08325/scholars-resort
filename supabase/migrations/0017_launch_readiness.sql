-- 0017_launch_readiness.sql
-- Announcements Table for Launch

CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(50) DEFAULT 'info' CHECK (priority IN ('info', 'warning', 'urgent')),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active announcements" ON public.announcements FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL USING (public.is_admin());

-- Pre-seed an initial welcome announcement
INSERT INTO public.announcements (title, content, priority) VALUES (
    'Welcome to Scholars Resort!',
    'We are thrilled to launch the ultimate JAMB preparation platform. Dive into our Practice Engine, compete in Tournaments, and utilize the AI Tutor to maximize your scores!',
    'info'
);
