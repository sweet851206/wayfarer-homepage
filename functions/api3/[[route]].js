import { listPosts, createPost, updatePost, deletePost, votePost, listComments, createComment, deleteComment, json } from "../_store.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  try {
    if (request.method === "GET" && action === "list") {
      return json({ ok: true, posts: await listPosts(env.BLOG_DB, "bunny") });
    }
    if (request.method === "GET" && action === "comments") {
      return json({ ok: true, comments: await listComments(env.BLOG_DB, url.searchParams.get("postId")) });
    }
    if (request.method === "POST" && action === "comment") {
      return json(await createComment(request, env.BLOG_DB));
    }
    if (request.method === "POST" && action === "comment_delete") {
      return json(await deleteComment(request, env.BLOG_DB));
    }
    if (request.method === "POST" && action === "vote") {
      return json(await votePost(request, env.BLOG_DB));
    }
    if (request.method === "POST" && action === "create") {
      return json(await createPost(request, env.BLOG_DB, env.BLOG_FILES, "bunny"));
    }
    if (request.method === "POST" && action === "update") {
      return json(await updatePost(request, env.BLOG_DB, "bunny"));
    }
    if (request.method === "POST") {
      return json(await deletePost(request, env.BLOG_DB, env.BLOG_FILES, "bunny"));
    }
    return json({ ok: false, message: "not found" }, 404);
  } catch (e) {
    return json({ ok: false, message: String((e && e.message) || e) }, 500);
  }
}
