-- Migration 0030: Add tournament prize and entry fields
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS cash_prize NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS entry_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS sponsor TEXT,
ADD COLUMN IF NOT EXISTS scholarship_description TEXT;
