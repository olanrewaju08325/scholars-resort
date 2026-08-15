-- V1 Initial Schema for Scholars Resort

-- USERS TABLE (Extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone_number TEXT,
    role VARCHAR(50) DEFAULT 'student' CHECK (role IN ('student', 'admin', 'guardian')),
    streak_days INTEGER DEFAULT 0,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP DEFAULT timezone('utc', now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- SUBJECTS TABLE
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    version INTEGER DEFAULT 1, -- For V2 offline sync
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

-- TOPICS TABLE
CREATE TABLE public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

-- QUESTIONS TABLE
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of strings e.g. ["Option A", "Option B", "Option C", "Option D"]
    correct_answer TEXT NOT NULL, -- The exact string of the correct option
    explanation TEXT,
    difficulty VARCHAR(50) CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

-- MOCK EXAMS (Scheduled/Weekly)
CREATE TABLE public.mock_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 120,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

-- EXAM SESSIONS (Student taking an exam)
CREATE TABLE public.exam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    mock_exam_id UUID REFERENCES public.mock_exams(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'abandoned')),
    score INTEGER,
    total_questions INTEGER,
    started_at TIMESTAMP DEFAULT timezone('utc', now()),
    submitted_at TIMESTAMP
);

-- PRACTICE SESSIONS (Casual practice)
CREATE TABLE public.practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    score INTEGER,
    total_questions INTEGER,
    started_at TIMESTAMP DEFAULT timezone('utc', now()),
    completed_at TIMESTAMP
);

-- SESSION ANSWERS (Stores individual answers for both mock and practice)
CREATE TABLE public.session_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    exam_session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
    practice_session_id UUID REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_answer TEXT,
    is_correct BOOLEAN,
    time_spent_seconds INTEGER,
    created_at TIMESTAMP DEFAULT timezone('utc', now()),
    CONSTRAINT check_session_type CHECK (
        (exam_session_id IS NOT NULL AND practice_session_id IS NULL) OR 
        (exam_session_id IS NULL AND practice_session_id IS NOT NULL)
    )
);

-- SUBSCRIPTIONS & MANUAL PAYMENTS
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

CREATE TABLE public.manual_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount DECIMAL NOT NULL,
    payment_date TIMESTAMP DEFAULT timezone('utc', now()),
    proof_image_url TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    verified_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

-- DUMMY DATA FOR TESTING
INSERT INTO public.subjects (id, name, icon) VALUES 
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Mathematics', 'calculator'),
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'English Language', 'book'),
('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'Physics', 'atom'),
('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380d44', 'Chemistry', 'flask');

INSERT INTO public.topics (id, subject_id, name) VALUES 
('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Algebra'),
('f2eebc99-9c0b-4ef8-bb6d-6bb9bd380f22', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Lexis and Structure');

INSERT INTO public.questions (subject_id, topic_id, question_text, options, correct_answer, explanation) VALUES 
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f1eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', 'If 2x + 3 = 11, what is the value of x?', '["2", "3", "4", "5"]', '4', 'Subtract 3 from both sides: 2x = 8. Divide by 2: x = 4.'),
('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'f2eebc99-9c0b-4ef8-bb6d-6bb9bd380f22', 'Choose the correct spelling:', '["Accomodation", "Accommodation", "Acommodation", "Acomodation"]', 'Accommodation', 'The correct spelling has double c and double m.');