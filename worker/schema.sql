PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS gym_staff (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('editor','publisher')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gym_drafts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  document_json TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS gym_drafts_listing ON gym_drafts(archived, updated_at DESC, id);
CREATE TABLE IF NOT EXISTS gym_publications (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  source_draft_id TEXT,
  source_revision INTEGER,
  restored_from TEXT,
  previous_id TEXT,
  document_json TEXT NOT NULL,
  public_json TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gym_imports (
  request_id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

