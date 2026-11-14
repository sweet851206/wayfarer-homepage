import { sha256hex, json } from "./_store.js";

// 사이트 설정: D1 settings 테이블. 첫 설정자가 관리자 비번 해시를 등록하고 이후 변경은 비번 검증.
// maintenance: 공사중 모드 on/off, main_layout: main 형식(main1, main2, ...)
async function getSetting(db, key) {
  const r = await db.prepare("SELECT value FROM settings WHERE key=?").bind(key).first();
  return r && r.value ? String(r.value) : "";
}

async function setSetting(db, key, value) {
  await db.prepare(
    "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).bind(key, value).run();
}

async function readAdminHash(db) {
  let hash = await getSetting(db, "admin_pw");
  if (!hash) {
    const legacy = await getSetting(db, "maintenance_pw");
    if (legacy) {
      hash = legacy;
      await setSetting(db, "admin_pw", legacy);
    }
  }
  return hash;
}

async function checkPw(db, pw) {
  if (!pw) return { ok: false, message: "no pw" };
  const hash = await sha256hex(pw);
  const saved = await db.prepare(
    "SELECT value FROM settings WHERE key='admin_pw'"
  ).first();
  if (saved && saved.value) {
    if (saved.value !== hash) return { ok: false, message: "wrong pw" };
  } else {
    const legacy = await db.prepare(
      "SELECT value FROM settings WHERE key='maintenance_pw'"
    ).first();
    if (legacy && legacy.value) {
      if (legacy.value !== hash) return { ok: false, message: "wrong pw" };
      await db.prepare(
        "INSERT INTO settings(key,value) VALUES('admin_pw',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      ).bind(hash).run();
    } else {
      await db.prepare(
        "INSERT INTO settings(key,value) VALUES('admin_pw',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      ).bind(hash).run();
    }
  }
  return { ok: true };
}

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
      const chk = await checkPw(env.BLOG_DB, String((b && b.pw) || ""));
      if (!chk.ok) return json(chk, chk.message === "wrong pw" ? 403 : 401);
      const on = !!(b && b.on);
      await env.BLOG_DB.prepare(
        "INSERT INTO settings(key,value) VALUES('maintenance',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      ).bind(on ? "1" : "0").run();
      return json({ ok: true, on: on });
    }

    if (request.method === "GET" && action === "layout") {
      const row = await env.BLOG_DB.prepare(
        "SELECT value FROM settings WHERE key='main_layout'"
      ).first();
      return json({ ok: true, layout: row ? row.value : "main1" });
    }

    if (request.method === "POST" && action === "layout_set") {
      const b = await request.json();
      const chk = await checkPw(env.BLOG_DB, String((b && b.pw) || ""));
      if (!chk.ok) return json(chk, chk.message === "wrong pw" ? 403 : 401);
      const layout = String((b && b.layout) || "main1").slice(0, 20);
      await env.BLOG_DB.prepare(
        "INSERT INTO settings(key,value) VALUES('main_layout',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      ).bind(layout).run();
      return json({ ok: true, layout: layout });
    }

    if (request.method === "POST" && action === "login") {
      const b = await request.json();
      const id = String((b && b.id) || "").trim().slice(0, 64);
      const pw = String((b && b.pw) || "");
      if (!id || !pw) return json({ ok: false, message: "no cred" }, 401);
      const hash = await readAdminHash(env.BLOG_DB);
      if (!hash) {
        // 최초 1회: 문서화된 초기값(1234/1234)으로만 시드
        if (id === "1234" && pw === "1234") {
          await setSetting(env.BLOG_DB, "admin_pw", await sha256hex("1234"));
          await setSetting(env.BLOG_DB, "admin_id", "1234");
          return json({ ok: true, fresh: true });
        }
        return json({ ok: false, message: "not initialized" }, 401);
      }
      if (hash !== await sha256hex(pw)) return json({ ok: false, message: "wrong pw" }, 403);
      let savedId = await getSetting(env.BLOG_DB, "admin_id");
      if (!savedId) {
        await setSetting(env.BLOG_DB, "admin_id", id);
      } else if (id !== savedId) {
        return json({ ok: false, message: "wrong id" }, 403);
      }
      return json({ ok: true });
    }

    if (request.method === "POST" && action === "password_set") {
      const b = await request.json();
      const oldPw = String((b && b.oldPw) || "");
      const newId = String((b && b.newId) || "").trim().slice(0, 64);
      const newPw = String((b && b.newPw) || "");
      if (!oldPw || !newId || newPw.length < 4) return json({ ok: false, message: "bad request" }, 400);
      const hash = await readAdminHash(env.BLOG_DB);
      if (!hash) return json({ ok: false, message: "not initialized" }, 401);
      if (hash !== await sha256hex(oldPw)) return json({ ok: false, message: "wrong pw" }, 403);
      await setSetting(env.BLOG_DB, "admin_pw", await sha256hex(newPw));
      await setSetting(env.BLOG_DB, "admin_id", newId);
      return json({ ok: true });
    }

    return json({ ok: false, message: "not found" }, 404);
  } catch (e) {
    return json({ ok: false, message: String((e && e.message) || e) }, 500);
  }
}
