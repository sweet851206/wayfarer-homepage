var BOARDS = ["ai", "br", "tr", "rp", "pet"];

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
