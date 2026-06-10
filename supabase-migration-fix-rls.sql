-- ── Fix RLS for Memory Tables ──
-- The app uses Firebase Auth, so Supabase's auth.uid() returns null.
-- We must disable RLS to allow the app to manage data based on user_id strings.
-- Run this in the Supabase SQL Editor.

-- Disable RLS for memories table
ALTER TABLE IF EXISTS memories DISABLE ROW LEVEL SECURITY;

-- Disable RLS for session_summaries table
ALTER TABLE IF EXISTS session_summaries DISABLE ROW LEVEL SECURITY;
