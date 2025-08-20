// /pages/api/comments.js
export default async function handler(req, res) {
  try {
    const { slug, action } = req.query;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({
        error:
          "Missing Upstash config (set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN).",
      });
    }

    if (req.method === "GET") {
      // 📌 گرفتن کامنت‌ها
      const resp = await fetch(`${url}/lrange/comments:${slug}/0/-1`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await resp.json();
      const comments = (data.result || []).map((c) => JSON.parse(c));
      return res.status(200).json(comments);
    }

    if (req.method === "POST") {
      // 📌 ثبت کامنت یا ریپلای
      const body = JSON.parse(req.body || "{}");
      const { text, parentId, userId } = body;

      if (!text || !userId) {
        return res.status(400).json({ error: "Missing text or userId" });
      }

      const newComment = {
        id: Date.now().toString(),
        text,
        parentId: parentId || null,
        userId,
        time: new Date().toISOString(),
      };

      // اضافه کردن به لیست
      const pushRes = await fetch(`${url}/rpush/comments:${slug}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([JSON.stringify(newComment)]),
      });

      if (!pushRes.ok) {
        const err = await pushRes.text();
        return res.status(500).json({ error: "Failed to save", details: err });
      }

      return res.status(200).json(newComment);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error", details: String(err) });
  }
}
