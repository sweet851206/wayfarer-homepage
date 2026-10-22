CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  date TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  files TEXT DEFAULT '[]',
  likes INTEGER DEFAULT 0,
  dislikes INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_posts_board ON posts(board, created_at DESC);
CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  author TEXT DEFAULT '',
  content TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
CREATE TABLE IF NOT EXISTS ideas (id TEXT PRIMARY KEY, board TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ideas_board ON ideas(board, created_at DESC);
