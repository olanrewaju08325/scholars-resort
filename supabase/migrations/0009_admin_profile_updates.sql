-- V9: Admin Profile Updates Security Fix
-- Allows Admins to update user profiles (e.g. to set has_paid = true upon payment verification)

-- Drop it if it exists to avoid errors on rerun
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Create policy for Admins to update any profile
CREATE POLICY "Admins can update all profiles" ON public.profiles 
FOR UPDATE 
USING (public.is_admin());
