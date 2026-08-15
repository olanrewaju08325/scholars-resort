-- 0019_part17_enterprise.sql
-- Part 17: Enterprise Operations, Analytics, Security & Production

-- 1. Question Version History
CREATE TABLE IF NOT EXISTS public.question_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    editor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    previous_data JSONB NOT NULL,
    change_reason TEXT,
    version_number INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.question_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage question history" ON public.question_history;
CREATE POLICY "Admins can manage question history" ON public.question_history FOR ALL USING (public.is_admin());

-- 2. Admin Roles & Permissions
CREATE TABLE IF NOT EXISTS public.admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.admin_roles;
CREATE POLICY "Admins can manage roles" ON public.admin_roles FOR ALL USING (public.is_admin());

-- Default roles
INSERT INTO public.admin_roles (name, description, permissions) VALUES
('super_admin', 'Full access to everything', '["dashboard","students","subjects","questions","payments","support","ai","health","settings","tournaments","analytics","logs","roles","backups"]'),
('question_manager', 'Manage question bank and subjects', '["dashboard","subjects","questions","analytics"]'),
('finance_manager', 'Manage payments and revenue', '["dashboard","payments","analytics"]'),
('support_manager', 'Handle support tickets and students', '["dashboard","students","support","analytics"]')
ON CONFLICT (name) DO NOTHING;

-- 3. Admin Backups Log
CREATE TABLE IF NOT EXISTS public.admin_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type VARCHAR(100) NOT NULL,
    initiated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    record_count INT,
    file_size_kb INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.admin_backups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage backups" ON public.admin_backups;
CREATE POLICY "Admins can manage backups" ON public.admin_backups FOR ALL USING (public.is_admin());

-- 4. Platform Announcements (CMS)
CREATE TABLE IF NOT EXISTS public.platform_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'maintenance', 'celebration')),
    target_role VARCHAR(50) DEFAULT 'all',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.platform_announcements;
DROP POLICY IF EXISTS "Users can view active announcements" ON public.platform_announcements;
CREATE POLICY "Admins can manage announcements" ON public.platform_announcements FOR ALL USING (public.is_admin());
CREATE POLICY "Users can view active announcements" ON public.platform_announcements FOR SELECT USING (
    is_active = true AND (expires_at IS NULL OR expires_at > now())
);

-- 5. Performance: Add indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_status ON public.exam_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_submitted_at ON public.exam_sessions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_payments_created_at ON public.manual_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status, created_at DESC);

-- 6. Add quality_score to questions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'questions'
                   AND column_name = 'quality_score') THEN
        ALTER TABLE public.questions ADD COLUMN quality_score INT DEFAULT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'questions'
                   AND column_name = 'quality_flags') THEN
        ALTER TABLE public.questions ADD COLUMN quality_flags JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'questions'
                   AND column_name = 'version_number') THEN
        ALTER TABLE public.questions ADD COLUMN version_number INT DEFAULT 1;
    END IF;
END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
