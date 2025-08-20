export default async function handler(req, res) {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({
        error:
          "Upstash config missing. Set UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN in Vercel.",
      });
    }

    const { slug } = req.query || {};
    if (!slug) return res.status(400).json({ error: "Missing slug (book id)" });

    const listKey = `comments:${slug}`;

    // Parser امن
    const safeParse = (raw) => {
      let v = raw;
      try {
        v = JSON.parse(raw);
      } catch {}
      if (typeof v === "string") {
        try {
          v = JSON.parse(v);
        } catch {}
      }
      return v;
    };

    // -------------------
    // گرفتن کامنت‌ها (GET)
    // -------------------
    if (req.method === "GET") {
      const lr = await fetch(`${url}/lrange/${listKey}/0/-1`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!lr.ok) {
        const t = await lr.text();
        return res
          .status(500)
          .json({ error: "Upstash lrange error", details: t });
      }

      const data = await lr.json();
      const rawArr = Array.isArray(data?.result) ? data.result : [];

      const arr = rawArr
        .map((raw) => safeParse(raw))
        .filter((obj) => obj && typeof obj === "object")
        .map((obj) => ({
          id: String(obj.id || ""),
          parentId: obj.parentId || null,
          userId: String(obj.userId || "anon").slice(0, 64),
          text: typeof obj.text === "string" ? obj.text : "",
          time: Number(obj.time) || 0,
        }));

      arr.sort((a, b) => (a.time || 0) - (b.time || 0));
      return res.status(200).json(arr);
    }

    // -------------------
    // ثبت کامنت جدید (POST)
    // -------------------
    if (req.method === "POST") {
      let body = {};
      try {
        body = req.body || {};
        if (req.headers["content-type"]?.includes("application/json")) {
          if (typeof req.body === "string") {
            body = JSON.parse(req.body);
          }
        }
      } catch {}

      const { text, parentId = null, userId = "anon" } = body || {};
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Bad text" });
      }

      const doc = {
        id: "cmt_" + Math.random().toString(36).slice(2),
        parentId: parentId || null,
        userId: String(userId || "anon").slice(0, 64),
        text: text.trim().slice(0, 1500),
        time: Date.now(),
      };

      const payload = [JSON.stringify(doc)];

      const pushRes = await fetch(`${url}/rpush/${listKey}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!pushRes.ok) {
        const t = await pushRes.text();
        return res
          .status(500)
          .json({ error: "Upstash rpush error", details: t });
      }

      await fetch(`${url}/ltrim/${listKey}/0/999`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return res.status(200).json({ ok: true, doc });
    }

    // -------------------
    // حذف کامنت (DELETE)
    // -------------------
    if (req.method === "DELETE") {
      let body = {};
      try {
        body = req.body || {};
        if (req.headers["content-type"]?.includes("application/json")) {
          if (typeof req.body === "string") {
            body = JSON.parse(req.body);
          }
        }
      } catch {}

      const { commentId } = body || {};
      if (!commentId) {
        return res.status(400).json({ error: "Missing commentId" });
      }

      // ابتدا کل لیست رو می‌گیریم
      const lr = await fetch(`${url}/lrange/${listKey}/0/-1`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const data = await lr.json();
      const rawArr = Array.isArray(data?.result) ? data.result : [];

      // پیدا کردن همون آیتم
      const target = rawArr.find((raw) => {
        const obj = safeParse(raw);
        return obj?.id === commentId;
      });

      if (!target) {
        return res.status(404).json({ error: "Comment not found" });
      }

      // حذف با LREM
      const delRes = await fetch(`${url}/lrem/${listKey}/1`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([target]),
      });

      if (!delRes.ok) {
        const t = await delRes.text();
        return res
          .status(500)
          .json({ error: "Upstash lrem error", details: t });
      }

      return res.status(200).json({ ok: true, deletedId: commentId });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Server error comments", details: String(e) });
  }
}
