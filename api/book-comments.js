export default async function handler(req, res) {
  try {
    const url   = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({
        error: "Missing Upstash config. Set UPSTASH_REDIS_REST_URL & UPSTASH_REST_TOKEN in Vercel.",
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
          likes: Number(o.likes || 0),
          dislikes: Number(o.dislikes || 0),
        }));

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ list });
    }

    // --- POST -> add comment ---
    if (req.method === "POST") {
      let body = {};
      try {
        body = req.body ?? await req.json?.() ?? {};
      } catch {
        body = req.body || {};
      }

      const text = (body?.text || "").toString().trim();
      if (!text) return res.status(400).json({ error: "Empty text" });

      const doc = {
        id: "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
        text,
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
      const { id, action } = req.body || {};
      if (!id || !["like", "dislike"].includes(action)) {
        return res.status(400).json({ error: "Invalid parameters" });
      }

      // کل لیست رو می‌گیریم
      const r = await fetch(`${url}/lrange/${key}/0/-1`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await r.json();
      const arr = Array.isArray(data?.result) ? data.result : [];

      let updated = null;
      const newArr = arr.map((s) => {
        try {
          const outer = JSON.parse(s);
          const o = Array.isArray(outer) && outer[0] ? JSON.parse(outer[0]) : outer;
          if (o.id === id) {
            if (action === "like") o.likes = (o.likes || 0) + 1;
            if (action === "dislike") o.dislikes = (o.dislikes || 0) + 1;
            updated = o;
            return JSON.stringify(o);
          }
          return s;
        } catch {
          return s;
        }
      });

      if (!updated) return res.status(404).json({ error: "Comment not found" });

      // لیست جدید ذخیره بشه
      await fetch(`${url}/del/${key}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (newArr.length > 0) {
        await fetch(`${url}/rpush/${key}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newArr),
        });
      }

      return res.status(200).json({ ok: true, doc: updated });
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Server error book-comments", details: String(e) });
  }
}
