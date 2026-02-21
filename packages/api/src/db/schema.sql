CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_type TEXT,
  transports TEXT, -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  user_id TEXT, -- NULL for registration when no users
  type TEXT NOT NULL CHECK(type IN ('registration', 'authentication')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS file_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  volume TEXT NOT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  extension TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  is_directory INTEGER NOT NULL DEFAULT 0,
  has_thumbnail INTEGER NOT NULL DEFAULT 0,
  modified_at TEXT NOT NULL,
  indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(volume, path)
);

CREATE INDEX IF NOT EXISTS idx_file_index_volume ON file_index(volume);
CREATE INDEX IF NOT EXISTS idx_file_index_name ON file_index(name);
CREATE INDEX IF NOT EXISTS idx_file_index_extension ON file_index(extension);

CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  volume TEXT NOT NULL,
  path TEXT NOT NULL,
  password_hash TEXT,
  max_downloads INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
