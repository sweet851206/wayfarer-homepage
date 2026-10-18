import { listPosts, createPost, deletePost, json } from "../_store.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  try {
    if (request.method === "GET" && action === "list") {
      return json({ ok: true, posts: await listPosts(env.BLOG_DB, "bunny") });
    }
    if (request.method === "POST" && action === "create") {
      return json(await createPost(request, env.BLOG_DB, env.BLOG_FILES, "bunny"));
    }
    if (request.method === "POST") {
      return json(await deletePost(request, env.BLOG_DB, env.BLOG_FILES, "bunny"));
    }
    return json({ ok: false, message: "not found" }, 404);
  } catch (e) {
    return json({ ok: false, message: String((e && e.message) || e) }, 500);
  }
}
