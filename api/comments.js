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

    // پارسر امن که دوبار هم اگر لازم بود پارس می‌کنه
    const safeParse = (raw) => {
      let v = raw;
      try { v = JSON.parse(raw); } catch {}
      if (typeof v === "string") {
        try { v = JSON.parse(v); } catch {}
      }
      return v;
    };

    if (req.method === "GET") {
      const lr = await fetch(`${url}/lrange/${listKey}/0/-1`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!lr.ok) {
        const t = await lr.text();
        return res.status(500).json({ error: "Upstash lrange error", details: t });
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

    if (req.method === "POST") {
      const contentType = req.headers["content-type"] || "";
      let body = {};
      if (contentType.includes("application/json")) {
        try { body = await req.json?.() } catch {}
      } else {
        // در Next.js معمولا req.body آماده است
        body = req.body || {};
      }

      const { text, parentId = null, userId = "anon" } = body || {};
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Bad text" });
      }

      const doc = {
        id: "cmt_" + Math.random().toString(36).slice(2),
        parentId: parentId || null,
        userId: String(userId || "anon").slice(0, 64),
        text: text.trim().slice(0, 1500),
        time: Date.now()
      };

      // RPUSH listKey [stringifiedDoc]
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
        return res.status(500).json({ error: "Upstash rpush error", details: t });
      }

      await fetch(`${url}/ltrim/${listKey}/0/999`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return res.status(200).json({ ok: true, doc });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Server error comments", details: String(e) });
  }
}
