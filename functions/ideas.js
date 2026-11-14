var BOARDS = ["ai", "br", "br2", "br3", "ai2", "ai3", "tr", "rp", "pet", "m3a", "m3b"];

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}

function extOf(name, mime, fallback) {
  const ext = ((String(name || "").split(".").pop() || String(mime || "").split("/")[1] || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5)) || fallback;
  return ext;
}

async function storeUploadFile(env, board, id, kind, file) {
  const isPhoto = kind === "photo";
  const maxBytes = isPhoto ? 8 * 1024 * 1024 : 20 * 1024 * 1024;
  const name = String((file && file.name) || "");
  const type = String((file && file.type) || "");
  const ext = extOf(name, type, isPhoto ? "png" : "mp4");
  const okType = isPhoto
    ? (/^image\//.test(type) || /^(png|jpe?g|gif|webp|bmp|svg)$/.test(ext))
    : (/^video\//.test(type) || /^(mp4|webm|mov|m4v)$/.test(ext));
  if (!okType) throw new Error(isPhoto ? "bad photo" : "bad video");
  const buf = await file.arrayBuffer();
  if (!buf || buf.byteLength === 0) throw new Error(isPhoto ? "bad photo" : "bad video");
  if (buf.byteLength > maxBytes) throw new Error(isPhoto ? "photo too big" : "video too big");
  if (!env.BLOG_FILES) throw new Error(isPhoto ? "photo upload failed" : "video upload failed");
  const key = "ideas/" + board + "/" + id + "/" + kind + "." + ext;
  await env.BLOG_FILES.put(key, buf, { httpMetadata: { contentType: type || "application/octet-stream" } });
  return "/files/" + key;
}

function uploadErrStatus(msg) {
  return /^(bad |.*too big$)/.test(String(msg || "")) ? 400 : 500;
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
      const ctype = request.headers.get("content-type") || "";
      let board = url.searchParams.get("board") || "";
      let item = null;
      let photoFile = null;
      let videoFile = null;
      if (ctype.indexOf("multipart/form-data") >= 0) {
        let fd = null;
        try { fd = await request.formData(); } catch (e) { return json({ ok: false, message: "bad request" }, 400); }
        board = String(fd.get("board") || board);
        try { item = JSON.parse(String(fd.get("item") || "")); } catch (e) { return json({ ok: false, message: "bad request" }, 400); }
        const pf = fd.get("photo");
        const vf = fd.get("video");
        if (pf && typeof pf !== "string" && pf.size > 0) photoFile = pf;
        if (vf && typeof vf !== "string" && vf.size > 0) videoFile = vf;
      } else {
        const b = await request.json();
        if (!b || BOARDS.indexOf(b.board) < 0 || !b.item || !b.item.id) {
          return json({ ok: false, message: "bad request" }, 400);
        }
        board = b.board;
        item = b.item;
      }
      if (!item || !item.id || BOARDS.indexOf(board) < 0) {
        return json({ ok: false, message: "bad request" }, 400);
      }
      const id = String(item.id);
      if (photoFile) {
        try {
          item.photo = await storeUploadFile(env, board, id, "photo", photoFile);
        } catch (e) {
          const msg = String((e && e.message) || e);
          return json({ ok: false, message: msg }, uploadErrStatus(msg));
        }
      } else if (item.photoData && env.BLOG_FILES) {
        try {
          const m = String(item.photoData).match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
          if (!m) return json({ ok: false, message: "bad photo" }, 400);
          const bin = Uint8Array.from(atob(m[2]), function (c) { return c.charCodeAt(0); });
          if (bin.length > 8 * 1024 * 1024) return json({ ok: false, message: "photo too big" }, 400);
          const ext = (m[1].split("/")[1] || "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
          const key = "ideas/" + board + "/" + id + "/photo." + ext;
          await env.BLOG_FILES.put(key, bin, { httpMetadata: { contentType: m[1] } });
          item.photo = "/files/" + key;
        } catch (e) {
          return json({ ok: false, message: "photo upload failed" }, 500);
        }
        delete item.photoData;
      }
      if (videoFile) {
        try {
          item.video = await storeUploadFile(env, board, id, "video", videoFile);
        } catch (e) {
          const msg = String((e && e.message) || e);
          return json({ ok: false, message: msg }, uploadErrStatus(msg));
        }
      } else if (item.videoData && env.BLOG_FILES) {
        try {
          const m = String(item.videoData).match(/^data:(video\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
          if (!m) return json({ ok: false, message: "bad video" }, 400);
          const bin = Uint8Array.from(atob(m[2]), function (c) { return c.charCodeAt(0); });
          if (bin.length > 20 * 1024 * 1024) return json({ ok: false, message: "video too big" }, 400);
          const ext = (m[1].split("/")[1] || "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "mp4";
          const key = "ideas/" + board + "/" + id + "/video." + ext;
          await env.BLOG_FILES.put(key, bin, { httpMetadata: { contentType: m[1] } });
          item.video = "/files/" + key;
        } catch (e) {
          return json({ ok: false, message: "video upload failed" }, 500);
        }
        delete item.videoData;
      }
      await env.BLOG_DB.prepare(
        "INSERT INTO ideas(id,board,data,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data"
      ).bind(id, board, JSON.stringify(item), new Date().toISOString()).run();
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
