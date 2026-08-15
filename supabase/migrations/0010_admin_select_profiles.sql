-- V10: Admin Select Profiles Bug Fix
-- Fixes the "0 students" bug in the Admin dashboard where Admins could not read the profiles table
-- because the initial schema only contained a SELECT policy for users reading their own profile.

-- Ensure the old policy wasn't doing something unexpected
-- In 0001_initial_schema: CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);

-- We just need to add a new policy for Admins to view ALL profiles.
-- We use our existing public.is_admin() helper.

-- Drop it if it exists to avoid errors on rerun
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create policy for Admins to read any profile
CREATE POLICY "Admins can view all profiles" ON public.profiles 
FOR SELECT 
USING (public.is_admin());
