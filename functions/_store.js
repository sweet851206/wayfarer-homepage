var ALLOWED_BOARDS = ["travel", "bunny", "repair", "ai", "branding", "travel-board", "repair-board", "bunny-board"];
function pickBoard(v, fallback) {
  v = String(v || "");
  return ALLOWED_BOARDS.indexOf(v) >= 0 ? v : fallback;
}

export async function listPosts(db, board) {
  const r = await db.prepare(
    "SELECT id,board,title,content,date,created_at,files FROM posts ORDER BY created_at DESC"
  ).all();
  return (r.results || []).map(function (row) {
    var files = [];
    try { files = JSON.parse(row.files || "[]"); } catch (e) {}
    return {
      id: row.id, title: row.title, content: row.content, date: row.date,
      category: row.board, createdAt: row.created_at, files: files
    };
  });
}

export async function createPost(req, db, bucket, board) {
  const fd = await req.formData();
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
    "INSERT INTO posts(id,board,title,content,date,created_at,files) VALUES(?,?,?,?,?,?,?)"
  ).bind(
    id, boardName,
    String(fd.get("title") || ""), String(fd.get("content") || ""),
    String(fd.get("date") || ""), created, JSON.stringify(files)
  ).run();
  return { ok: true, id: id };
}

export async function updatePost(req, db, board) {
  const fd = await req.formData();
  const id = String(fd.get("id") || "");
  if (!id) return { ok: false, message: "no id" };
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

export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
