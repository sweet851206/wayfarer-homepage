var ALLOWED_BOARDS = ["travel", "bunny", "repair", "ai", "ai-video", "branding", "branding2", "travel-board", "repair-board", "bunny-board"];
function pickBoard(v, fallback) {
  v = String(v || "");
  return ALLOWED_BOARDS.indexOf(v) >= 0 ? v : fallback;
}

export async function listPosts(db, board) {
  try { await db.prepare("ALTER TABLE posts ADD COLUMN likes INTEGER DEFAULT 0").run(); } catch (e) {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN dislikes INTEGER DEFAULT 0").run(); } catch (e) {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN views INTEGER DEFAULT 0").run(); } catch (e) {}
  const r = await db.prepare(
    "SELECT id,board,title,content,date,created_at,files,COALESCE(likes,0) AS likes,COALESCE(dislikes,0) AS dislikes,COALESCE(views,0) AS views FROM posts ORDER BY created_at DESC"
  ).all();
  return (r.results || []).map(function (row) {
    var files = [];
    try { files = JSON.parse(row.files || "[]"); } catch (e) {}
    return {
      id: row.id, title: row.title, content: row.content, date: row.date,
      category: row.board, createdAt: row.created_at, files: files,
      likes: row.likes || 0, dislikes: row.dislikes || 0, views: row.views || 0
    };
  });
}

export async function createPost(req, db, bucket, board) {
  const fd = await req.formData();
  try { await db.prepare("ALTER TABLE posts ADD COLUMN pw TEXT DEFAULT ''").run(); } catch (e) {}
  const pwRaw = String(fd.get("pw") || "").trim();
  if (pwRaw.length < 4) return { ok: false, message: "수정용 비밀번호(4자 이상)를 입력하세요." };
  const pwHash = await sha256hex(pwRaw);
  const boardName = pickBoard(fd.get("category"), board);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const files = [];
  const uploads = fd.getAll("files[]");
  for (const f of uploads) {
    if (typeof f === "string" || !f.name) continue;
    const key = boardName + "/" + id + "/" + f.name;
    await bucket.put(key, await f.arrayBuffer(), {
      httpMetadata: { contentType: f.type || "application/octet-stream" }
    });
    files.push({
      name: f.name, originalName: f.name, type: f.type,
      size: f.size, key: key, url: "/files/" + key
    });
  }
  const created = new Date().toISOString();
  await db.prepare(
    "INSERT INTO posts(id,board,title,content,date,created_at,files,likes,dislikes,pw) VALUES(?,?,?,?,?,?,?,?,?,?)"
  ).bind(
    id, boardName,
    String(fd.get("title") || ""), String(fd.get("content") || ""),
    String(fd.get("date") || ""), created, JSON.stringify(files), 0, 0, pwHash
  ).run();
  return { ok: true, id: id };
}

export async function updatePost(req, db, board) {
  const fd = await req.formData();
  const id = String(fd.get("id") || "");
  if (!id) return { ok: false, message: "no id" };
  try { await db.prepare("ALTER TABLE posts ADD COLUMN pw TEXT DEFAULT ''").run(); } catch (e) {}
  const stored = await db.prepare("SELECT pw FROM posts WHERE id=?").bind(id).first();
  const savedPw = stored && stored.pw ? String(stored.pw) : "";
  if (savedPw) {
    const tryHash = await sha256hex(String(fd.get("pw") || ""));
    if (tryHash !== savedPw) return { ok: false, message: "비밀번호가 틀렸습니다." };
  }
  await db.prepare(
    "UPDATE posts SET title=?, content=?, date=? WHERE id=?"
  ).bind(
    String(fd.get("title") || ""), String(fd.get("content") || ""),
    String(fd.get("date") || ""), id
  ).run();
  return { ok: true, id: id };
}

export async function deletePost(req, db, bucket, board) {
  var id = "";
  try {
    const b = await req.json();
    id = (b && b.id) || "";
  } catch (e) {}
  if (!id) {
    const m = new URL(req.url).pathname.match(/([^/]+)$/);
    id = m ? decodeURIComponent(m[1]) : "";
  }
  if (!id) return { ok: false, message: "no id" };
  const row = await db.prepare(
    "SELECT files FROM posts WHERE id=?"
  ).bind(id).first();
  if (row) {
    try {
      const files = JSON.parse(row.files || "[]");
      for (const f of files) { if (f.key) await bucket.delete(f.key); }
    } catch (e) {}
  }
  await db.prepare("DELETE FROM posts WHERE id=?").bind(id).run();
  return { ok: true };
}

export async function votePost(req, db) {
  var id = "", kind = "";
  try {
    const b = await req.json();
    id = String((b && b.id) || "");
    kind = String((b && b.kind) || "");
  } catch (e) {}
  if (!id || (kind !== "like" && kind !== "dislike")) return { ok: false, message: "bad vote" };
  try { await db.prepare("ALTER TABLE posts ADD COLUMN likes INTEGER DEFAULT 0").run(); } catch (e) {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN dislikes INTEGER DEFAULT 0").run(); } catch (e) {}
  if (kind === "like") await db.prepare("UPDATE posts SET likes=COALESCE(likes,0)+1 WHERE id=?").bind(id).run();
  else await db.prepare("UPDATE posts SET dislikes=COALESCE(dislikes,0)+1 WHERE id=?").bind(id).run();
  const row = await db.prepare("SELECT COALESCE(likes,0) AS likes, COALESCE(dislikes,0) AS dislikes FROM posts WHERE id=?").bind(id).first();
  return { ok: true, id: id, likes: (row && row.likes) || 0, dislikes: (row && row.dislikes) || 0 };
}

export async function viewPost(req, db) {
  var id = "";
  try {
    const b = await req.json();
    id = String((b && b.id) || "");
  } catch (e) {}
  if (!id) return { ok: false, message: "no id" };
  try { await db.prepare("ALTER TABLE posts ADD COLUMN views INTEGER DEFAULT 0").run(); } catch (e) {}
  await db.prepare("UPDATE posts SET views=COALESCE(views,0)+1 WHERE id=?").bind(id).run();
  const row = await db.prepare("SELECT COALESCE(views,0) AS views FROM posts WHERE id=?").bind(id).first();
  return { ok: true, id: id, views: (row && row.views) || 0 };
}

export async function ensureCommentsTable(db) {
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, author TEXT DEFAULT '', content TEXT DEFAULT '', created_at TEXT NOT NULL)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at)").run();
  } catch (e) {}
}

export async function listComments(db, postId) {
  await ensureCommentsTable(db);
  const r = await db.prepare("SELECT id,post_id,author,content,created_at FROM comments WHERE post_id=? ORDER BY created_at ASC LIMIT 100").bind(String(postId || "")).all();
  return (r.results || []).map(function (row) {
    return { id: row.id, postId: row.post_id, author: row.author, content: row.content, createdAt: row.created_at };
  });
}

export async function createComment(req, db) {
  await ensureCommentsTable(db);
  var body = {};
  try { body = await req.json(); } catch (e) { body = {}; }
  var postId = String((body && body.postId) || "");
  var author = String((body && body.author) || "").slice(0, 30);
  var content = String((body && body.content) || "").slice(0, 500);
  if (!postId || !content) return { ok: false, message: "bad comment" };
  if (!author) author = "익명";
  var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  var created = new Date().toISOString();
  await db.prepare("INSERT INTO comments(id,post_id,author,content,created_at) VALUES(?,?,?,?,?)").bind(id, postId, author, content, created).run();
  return { ok: true, id: id };
}

export async function deleteComment(req, db) {
  await ensureCommentsTable(db);
  var body = {};
  try { body = await req.json(); } catch (e) { body = {}; }
  var id = String((body && body.id) || "");
  if (!id) return { ok: false, message: "no id" };
  await db.prepare("DELETE FROM comments WHERE id=?").bind(id).run();
  return { ok: true };
}

export async function sha256hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s || "")));
  return Array.from(new Uint8Array(d)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}

export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
