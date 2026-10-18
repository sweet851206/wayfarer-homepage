export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") {
    return new Response("not found", { status: 404 });
  }
  const key = new URL(request.url).pathname.replace(/^\/files\//, "");
  if (!key || key.includes("..")) {
    return new Response("not found", { status: 404 });
  }
  const obj = await env.BLOG_FILES.get(decodeURIComponent(key));
  if (!obj) {
    return new Response("not found", { status: 404 });
  }
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000"
    }
  });
}
