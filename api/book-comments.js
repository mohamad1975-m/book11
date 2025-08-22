export default async function handler(req, res) {
  try {
    const url   = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({
        error: "Missing Upstash config. Set UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN in Vercel.",
      });
    }

    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const key = `comments:${slug}`;

    // --- GET -> list ---
    if (req.method === "GET") {
      const r = await fetch(`${url}/lrange/${key}/0/-1`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!r.ok) {
        const t = await r.text();
        return res.status(500).json({ error: "Upstash lrange error", details: t });
      }
      const data = await r.json();
      const arr = Array.isArray(data?.result) ? data.result : [];

      const list = arr
        .map((s) => {
          try {
            const outer = JSON.parse(s);
            if (Array.isArray(outer) && outer.length > 0) {
              return JSON.parse(outer[0]);
            }
            return outer;
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .map((o) => ({
          id: String(o.id || ""),
          text: String(o.text || ""),
          nickname: String(o.nickname || "ناشناس"),
          likes: Number(o.likes) || 0,
          dislikes: Number(o.dislikes) || 0,
          ts: Number(o.ts) || Date.now(),
        }));

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ list });
    }

    // --- POST -> add new comment ---
    if (req.method === "POST") {
      let body = {};
      try {
        body = req.body ?? await req.json?.() ?? {};
      } catch {
        body = req.body || {};
      }

      const text = (body?.text || "").toString().trim();
      const nickname = (body?.nickname || "ناشناس").toString().trim();

      if (!text) return res.status(400).json({ error: "Empty text" });

      const doc = {
        id: "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
        text,
        nickname,
        likes: 0,
        dislikes: 0,
        ts: Date.now(),
      };

      const payload = JSON.stringify(doc);

      const p = await fetch(`${url}/rpush/${key}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([payload]),
      });

      if (!p.ok) {
        const t = await p.text();
        return res.status(500).json({ error: "Upstash rpush error", details: t });
      }

      await fetch(`${url}/ltrim/${key}/0/999`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return res.status(200).json({ ok: true, doc });
    }

    // --- PATCH -> like/dislike update ---
    if (req.method === "PATCH") {
      let body = {};
      try {
        body = req.body ?? await req.json?.() ?? {};
      } catch {
        body = req.body || {};
      }

      const { id, action } = body;
      if (!id || !["like", "dislike"].includes(action)) {
        return res.status(400).json({ error: "Invalid id or action" });
      }

      // دریافت لیست کامل
      const r = await fetch(`${url}/lrange/${key}/0/-1`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await r.json();
      const arr = Array.isArray(data?.result) ? data.result : [];

      let updatedDoc = null;

      const newArr = arr.map((s) => {
        try {
          const outer = JSON.parse(s);
          const obj = Array.isArray(outer) && outer.length > 0 ? JSON.parse(outer[0]) : outer;
          if (obj.id === id) {
            if (action === "like") obj.likes = (obj.likes || 0) + 1;
            if (action === "dislike") obj.dislikes = (obj.dislikes || 0) + 1;
            updatedDoc = obj;
            return JSON.stringify(obj);
          }
          return s;
        } catch {
          return s;
        }
      });

      if (!updatedDoc) {
        return res.status(404).json({ error: "Comment not found" });
      }

      // ذخیره لیست جدید
      await fetch(`${url}/del/${key}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetch(`${url}/rpush/${key}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newArr),
      });

      return res.status(200).json({ ok: true, doc: updatedDoc });
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Server error book-comments", details: String(e) });
  }
}
