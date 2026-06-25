-- ── Frontend-facing tables for Beatrice Agent ──
-- These tables are what the frontend code (BeatriceMemoryService.ts, supabaseStorage.ts)
-- queries directly. They are maintained separately from the core beatrice_* schema
-- for backward compatibility with the client-side code.

-- 1. Messages table (frontend queries 'messages', not 'beatrice_messages')
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'model', 'system', 'tool')),
  text TEXT NOT NULL,
  session_id TEXT,
  tool_name TEXT,
  tool_input JSONB,
  tool_result JSONB,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON messages;
DROP POLICY IF EXISTS "Users can update own messages" ON messages;

CREATE POLICY "Users can read own messages"
  ON messages FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own messages"
  ON messages FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (user_id = auth.uid()::text);

-- 2. Memories table (frontend queries 'memories', not 'beatrice_memory_records')
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'manual_note',
  source_id TEXT,
  session_id TEXT,
  memory_type TEXT DEFAULT 'fact',
  importance_score REAL DEFAULT 1.0,
  recency_score REAL DEFAULT 1.0,
  is_stale BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own memories" ON memories;
DROP POLICY IF EXISTS "Users can insert own memories" ON memories;
DROP POLICY IF EXISTS "Users can update own memories" ON memories;
DROP POLICY IF EXISTS "Users can delete own memories" ON memories;

CREATE POLICY "Users can read own memories"
  ON memories FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own memories"
  ON memories FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own memories"
  ON memories FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own memories"
  ON memories FOR DELETE
  USING (user_id = auth.uid()::text);

-- 3. Session summaries table
CREATE TABLE IF NOT EXISTS session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_start TIMESTAMPTZ,
  session_end TIMESTAMPTZ,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_user ON session_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_end ON session_summaries(session_end DESC);

ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own session_summaries" ON session_summaries;
CREATE POLICY "Users can read own session_summaries"
  ON session_summaries FOR SELECT
  USING (user_id = auth.uid()::text);

-- 4. Knowledge files table
CREATE TABLE IF NOT EXISTS knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_files_user ON knowledge_files(user_id);

ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own knowledge_files" ON knowledge_files;
DROP POLICY IF EXISTS "Users can insert own knowledge_files" ON knowledge_files;
DROP POLICY IF EXISTS "Users can delete own knowledge_files" ON knowledge_files;

CREATE POLICY "Users can read own knowledge_files"
  ON knowledge_files FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own knowledge_files"
  ON knowledge_files FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own knowledge_files"
  ON knowledge_files FOR DELETE
  USING (user_id = auth.uid()::text);

-- 5. User settings table (frontend queries this for avatar_url, knowledge_domains, etc.)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  persona_name TEXT DEFAULT 'Beatrice',
  custom_prompt TEXT DEFAULT '',
  selected_voice TEXT DEFAULT 'Aoede',
  user_title TEXT DEFAULT 'Boss',
  language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'dark',
  context_size INTEGER DEFAULT 20,
  censorship_enabled BOOLEAN DEFAULT true,
  ambient_enabled BOOLEAN DEFAULT true,
  ambient_volume INTEGER DEFAULT 12,
  timezone TEXT,
  avatar_url TEXT,
  knowledge_domains TEXT[] DEFAULT '{}',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own user_settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own user_settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own user_settings" ON user_settings;

CREATE POLICY "Users can read own user_settings"
  ON user_settings FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own user_settings"
  ON user_settings FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own user_settings"
  ON user_settings FOR UPDATE
  USING (user_id = auth.uid()::text);
