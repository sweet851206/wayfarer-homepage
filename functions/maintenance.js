import { sha256hex, json } from "./_store.js";

// 공사중 모드: D1 settings 테이블에 flag 저장. 첫 설정자가 관리자 비번 해시를 등록하고 이후 변경은 비번 검증.
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "get";
  try {
    await env.BLOG_DB.prepare(
      "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    ).run();

    if (request.method === "GET" && action === "get") {
      const row = await env.BLOG_DB.prepare(
        "SELECT value FROM settings WHERE key='maintenance'"
      ).first();
      return json({ ok: true, on: row ? row.value === "1" : false });
    }

    if (request.method === "POST" && action === "set") {
      const b = await request.json();
      const on = !!(b && b.on);
      const pw = String((b && b.pw) || "");
      if (!pw) return json({ ok: false, message: "no pw" }, 401);
      const hash = await sha256hex(pw);
      const saved = await env.BLOG_DB.prepare(
        "SELECT value FROM settings WHERE key='maintenance_pw'"
      ).first();
      if (saved && saved.value) {
        if (saved.value !== hash) return json({ ok: false, message: "wrong pw" }, 403);
      } else {
        await env.BLOG_DB.prepare(
          "INSERT INTO settings(key,value) VALUES('maintenance_pw',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
        ).bind(hash).run();
      }
      await env.BLOG_DB.prepare(
        "INSERT INTO settings(key,value) VALUES('maintenance',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      ).bind(on ? "1" : "0").run();
      return json({ ok: true, on: on });
    }

    return json({ ok: false, message: "not found" }, 404);
  } catch (e) {
    return json({ ok: false, message: String((e && e.message) || e) }, 500);
  }
}
