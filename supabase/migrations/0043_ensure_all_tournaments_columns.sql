-- Migration 0043: Ensure all Tournaments and Tournament Participants columns exist idempotently
-- This guarantees the remote Supabase schema cache recognizes coin_reward, xp_reward, and all configuration fields.

DO $$ 
BEGIN
    -- 1. Ensure all columns exist on public.tournaments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'coin_reward') THEN
        ALTER TABLE public.tournaments ADD COLUMN coin_reward INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'xp_reward') THEN
        ALTER TABLE public.tournaments ADD COLUMN xp_reward INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'question_count') THEN
        ALTER TABLE public.tournaments ADD COLUMN question_count INTEGER DEFAULT 40;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'duration_minutes') THEN
        ALTER TABLE public.tournaments ADD COLUMN duration_minutes INTEGER DEFAULT 120;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'subject_filter') THEN
        ALTER TABLE public.tournaments ADD COLUMN subject_filter TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'registration_deadline') THEN
        ALTER TABLE public.tournaments ADD COLUMN registration_deadline TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'prize_description') THEN
        ALTER TABLE public.tournaments ADD COLUMN prize_description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'cash_prize') THEN
        ALTER TABLE public.tournaments ADD COLUMN cash_prize NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'entry_fee') THEN
        ALTER TABLE public.tournaments ADD COLUMN entry_fee NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'sponsor') THEN
        ALTER TABLE public.tournaments ADD COLUMN sponsor TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'scholarship_description') THEN
        ALTER TABLE public.tournaments ADD COLUMN scholarship_description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'is_private') THEN
        ALTER TABLE public.tournaments ADD COLUMN is_private BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'invite_code') THEN
        ALTER TABLE public.tournaments ADD COLUMN invite_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'password') THEN
        ALTER TABLE public.tournaments ADD COLUMN password TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'min_players') THEN
        ALTER TABLE public.tournaments ADD COLUMN min_players INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'max_players') THEN
        ALTER TABLE public.tournaments ADD COLUMN max_players INTEGER DEFAULT 1000;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'badge_reward') THEN
        ALTER TABLE public.tournaments ADD COLUMN badge_reward TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'difficulty') THEN
        ALTER TABLE public.tournaments ADD COLUMN difficulty TEXT DEFAULT 'mixed';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'question_source') THEN
        ALTER TABLE public.tournaments ADD COLUMN question_source TEXT DEFAULT 'mixed';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'rules') THEN
        ALTER TABLE public.tournaments ADD COLUMN rules TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'prize_pool') THEN
        ALTER TABLE public.tournaments ADD COLUMN prize_pool TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'is_premium_only') THEN
        ALTER TABLE public.tournaments ADD COLUMN is_premium_only BOOLEAN DEFAULT false;
    END IF;

    -- 2. Ensure admin_settings table has unique constraint on setting_key
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'admin_settings_setting_key_key'
    ) THEN
        -- Only add if setting_key is not already unique
        BEGIN
            ALTER TABLE public.admin_settings ADD CONSTRAINT admin_settings_setting_key_key UNIQUE (setting_key);
        EXCEPTION WHEN duplicate_table OR duplicate_object THEN
            -- already exists
            NULL;
        END;
    END IF;
END $$;

-- Force PostgREST schema cache to reload immediately
NOTIFY pgrst, 'reload schema';
