-- Multi-user authentication: users, project memberships, conversation ownership
-- Tables: remote_agent_users, remote_agent_project_members
-- Column: remote_agent_conversations.user_id

-- Users table
CREATE TABLE IF NOT EXISTS remote_agent_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Project members junction
CREATE TABLE IF NOT EXISTS remote_agent_project_members (
  user_id TEXT NOT NULL REFERENCES remote_agent_users(id) ON DELETE CASCADE,
  codebase_id TEXT NOT NULL REFERENCES remote_agent_codebases(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (user_id, codebase_id)
);

-- Add user_id to conversations (nullable — existing rows keep NULL)
ALTER TABLE remote_agent_conversations
  ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES remote_agent_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_user_id
  ON remote_agent_conversations(user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_members_user_id
  ON remote_agent_project_members(user_id);
