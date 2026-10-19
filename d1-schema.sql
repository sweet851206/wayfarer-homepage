CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  date TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  files TEXT DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_posts_board ON posts(board, created_at DESC);
CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ideas (id TEXT PRIMARY KEY, board TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ideas_board ON ideas(board, created_at DESC);
