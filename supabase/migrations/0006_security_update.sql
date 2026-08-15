-- V6: Security Update (Strict RLS for Phase 1-3 tables)

-- 1. Helper Function to Check Admin Role (to avoid joining profiles repeatedly)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply RLS to content tables (Read-Only for students, Full access for Admins)
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Subjects
CREATE POLICY "Anyone can read subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Admins can manage subjects" ON public.subjects FOR ALL USING (public.is_admin());

-- Topics
CREATE POLICY "Anyone can read topics" ON public.topics FOR SELECT USING (true);
CREATE POLICY "Admins can manage topics" ON public.topics FOR ALL USING (public.is_admin());

-- Questions
CREATE POLICY "Anyone can read questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Admins can manage questions" ON public.questions FOR ALL USING (public.is_admin());

-- Mock Exams
CREATE POLICY "Anyone can read mock exams" ON public.mock_exams FOR SELECT USING (true);
CREATE POLICY "Admins can manage mock exams" ON public.mock_exams FOR ALL USING (public.is_admin());

-- Flashcards
CREATE POLICY "Anyone can read flashcards" ON public.flashcards FOR SELECT USING (true);
CREATE POLICY "Admins can manage flashcards" ON public.flashcards FOR ALL USING (public.is_admin());

-- 3. Apply RLS to Session Tables (Students access their own, Admins access all)
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_answers ENABLE ROW LEVEL SECURITY;

-- Exam Sessions
CREATE POLICY "Users can read own exam sessions" ON public.exam_sessions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users can insert own exam sessions" ON public.exam_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exam sessions" ON public.exam_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Practice Sessions
CREATE POLICY "Users can read own practice sessions" ON public.practice_sessions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users can insert own practice sessions" ON public.practice_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own practice sessions" ON public.practice_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Session Answers
CREATE POLICY "Users can read own answers" ON public.session_answers FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users can insert own answers" ON public.session_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own answers" ON public.session_answers FOR UPDATE USING (auth.uid() = user_id);

-- 4. Apply RLS to Financial Tables (Manual Payments, Subscriptions)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

-- Subscriptions
CREATE POLICY "Users can read own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admins can insert subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update subscriptions" ON public.subscriptions FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete subscriptions" ON public.subscriptions FOR DELETE USING (public.is_admin());

-- Manual Payments
CREATE POLICY "Users can read own payments" ON public.manual_payments FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users can insert own payments" ON public.manual_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage payments" ON public.manual_payments FOR ALL USING (public.is_admin());

-- 5. Fix Profiles Table Role Exploitation
-- Users shouldn't be able to update their own role. We must replace the old update policy.
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

-- Allow users to update their profile BUT prevent changing role via a CHECK condition
-- Since Supabase standard update policies don't easily prevent specific column updates without triggers,
-- we'll rely on the frontend, BUT for security, let's create a trigger to protect the role column.
CREATE OR REPLACE FUNCTION public.protect_role_column()
RETURNS TRIGGER AS $$
BEGIN
  -- If the user doing the update is NOT an admin, and the role is changing, revert it.
  IF NOT public.is_admin() THEN
    NEW.role = OLD.role;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_role_protection ON public.profiles;
CREATE TRIGGER enforce_role_protection
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.protect_role_column();

-- Re-enable the update policy now that the column is protected
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);
