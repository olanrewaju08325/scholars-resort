-- Production Stability Fixes

-- 1. Create Leaderboard Entries View
CREATE OR REPLACE VIEW public.leaderboard_entries AS
SELECT 
    id as user_id, 
    xp as score,
    ROW_NUMBER() OVER(ORDER BY xp DESC) as rank,
    full_name,
    avatar_url
FROM public.profiles 
WHERE role = 'student';

-- 2. Ensure platform error logs can be inserted by authenticated users (or anyone if anon)
ALTER TABLE public.platform_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert error logs" 
ON public.platform_error_logs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view error logs" 
ON public.platform_error_logs 
FOR SELECT 
USING (public.is_admin());

-- 3. Ensure ai_usage has right policies for logging
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert ai usage" ON public.ai_usage;
CREATE POLICY "Anyone can insert ai usage" 
ON public.ai_usage 
FOR INSERT 
WITH CHECK (true);
