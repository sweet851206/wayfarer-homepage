export async function listPosts(db, board) {
  const r = await db.prepare(
    "SELECT id,title,content,date,created_at,files FROM posts WHERE board=? ORDER BY created_at DESC"
  ).bind(board).all();
  return (r.results || []).map(function (row) {
    var files = [];
    try { files = JSON.parse(row.files || "[]"); } catch (e) {}
    return {
      id: row.id, title: row.title, content: row.content, date: row.date,
      category: board, createdAt: row.created_at, files: files
    };
  });
}

export async function createPost(req, db, bucket, board) {
  const fd = await req.formData();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const files = [];
  const uploads = fd.getAll("files[]");
  for (const f of uploads) {
    if (typeof f === "string" || !f.name) continue;
    const key = board + "/" + id + "/" + f.name;
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
    "INSERT INTO posts(id,board,title,content,date,created_at,files) VALUES(?,?,?,?,?,?,)"
  ).bind(
    id, board,
    String(fd.get("title") || ""), String(fd.get("content") || ""),
    String(fd.get("date") || ""), created, JSON.stringify(files)
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
    "SELECT files FROM posts WHERE id=? AND board=?"
  ).bind(id, board).first();
  if (row) {
    try {
      const files = JSON.parse(row.files || "[]");
      for (const f of files) { if (f.key) await bucket.delete(f.key); }
    } catch (e) {}
  }
  await db.prepare("DELETE FROM posts WHERE id=? AND board=?").bind(id, board).run();
  return { ok: true };
}

export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
