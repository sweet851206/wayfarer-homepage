export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "get";
  try {
    await env.BLOG_DB.prepare(
      "CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, count INTEGER NOT NULL)"
    ).run();
    if (request.method === "POST" && action === "hit") {
      await env.BLOG_DB.prepare(
        "INSERT INTO visits(id,count) VALUES('total',1) ON CONFLICT(id) DO UPDATE SET count=count+1"
      ).run();
    }
    const row = await env.BLOG_DB.prepare(
      "SELECT count FROM visits WHERE id='total'"
    ).first();
    return new Response(JSON.stringify({ ok: true, count: (row && row.count) || 0 }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: String((e && e.message) || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
