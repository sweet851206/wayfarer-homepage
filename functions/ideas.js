var BOARDS = ["ai", "br", "br2", "br3", "ai2", "tr", "rp", "pet"];

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "list";
  const board = url.searchParams.get("board") || "";
  try {
    await env.BLOG_DB.prepare(
      "CREATE TABLE IF NOT EXISTS ideas (id TEXT PRIMARY KEY, board TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL)"
    ).run();
    await env.BLOG_DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_ideas_board ON ideas(board, created_at DESC)"
    ).run();

    if (request.method === "GET" && action === "list") {
      if (BOARDS.indexOf(board) < 0) return json({ ok: false, message: "bad board" }, 400);
      const r = await env.BLOG_DB.prepare(
        "SELECT id,data FROM ideas WHERE board=? ORDER BY created_at DESC"
      ).bind(board).all();
      const items = (r.results || []).map(function (row) {
        try {
          const o = JSON.parse(row.data);
          o.id = row.id;
          return o;
        } catch (e) { return null; }
      }).filter(function (x) { return x; });
      return json({ ok: true, items: items });
    }

    if (request.method === "POST" && action === "upsert") {
      const b = await request.json();
      if (!b || BOARDS.indexOf(b.board) < 0 || !b.item || !b.item.id) {
        return json({ ok: false, message: "bad request" }, 400);
      }
      const id = String(b.item.id);
      if (b.item.photoData && env.BLOG_FILES) {
        try {
          const m = String(b.item.photoData).match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
          if (!m) return json({ ok: false, message: "bad photo" }, 400);
          const bin = Uint8Array.from(atob(m[2]), function (c) { return c.charCodeAt(0); });
          if (bin.length > 8 * 1024 * 1024) return json({ ok: false, message: "photo too big" }, 400);
          const ext = (m[1].split("/")[1] || "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
          const key = "ideas/" + b.board + "/" + id + "/photo." + ext;
          await env.BLOG_FILES.put(key, bin, { httpMetadata: { contentType: m[1] } });
          b.item.photo = "/files/" + key;
        } catch (e) {
          return json({ ok: false, message: "photo upload failed" }, 500);
        }
        delete b.item.photoData;
      }
      if (b.item.videoData && env.BLOG_FILES) {
        try {
          const m = String(b.item.videoData).match(/^data:(video\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
          if (!m) return json({ ok: false, message: "bad video" }, 400);
          const bin = Uint8Array.from(atob(m[2]), function (c) { return c.charCodeAt(0); });
          if (bin.length > 20 * 1024 * 1024) return json({ ok: false, message: "video too big" }, 400);
          const ext = (m[1].split("/")[1] || "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "mp4";
          const key = "ideas/" + b.board + "/" + id + "/video." + ext;
          await env.BLOG_FILES.put(key, bin, { httpMetadata: { contentType: m[1] } });
          b.item.video = "/files/" + key;
        } catch (e) {
          return json({ ok: false, message: "video upload failed" }, 500);
        }
        delete b.item.videoData;
      }
      await env.BLOG_DB.prepare(
        "INSERT INTO ideas(id,board,data,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data"
      ).bind(id, b.board, JSON.stringify(b.item), new Date().toISOString()).run();
      return json({ ok: true, id: id });
    }

    if (request.method === "POST" && action === "delete") {
      const b = await request.json();
      if (!b || !b.id) return json({ ok: false, message: "no id" }, 400);
      await env.BLOG_DB.prepare("DELETE FROM ideas WHERE id=?").bind(String(b.id)).run();
      return json({ ok: true });
    }

    return json({ ok: false, message: "not found" }, 404);
  } catch (e) {
    return json({ ok: false, message: String((e && e.message) || e) }, 500);
  }
}
