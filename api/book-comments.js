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

    // Book ID from query or body
    const book =
      (req.query && req.query.book) ||
      (req.body && req.body.book);

    if (!book || typeof book !== "string") {
      return res.status(400).json({ error: "Missing 'book' slug" });
    }

    const listKey = `comments:${book}`;

    // Safe parse double-encoded strings
    const safeParse = (raw) => {
      let v = raw;
      try { v = JSON.parse(raw); } catch {}
      if (typeof v === "string") {
        try { v = JSON.parse(v); } catch {}
      }
      return v;
    };

    // --- GET: read all comments ---
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
          dev: String(obj.dev || ""),
          name: String(obj.name || "کاربر ناشناس").slice(0, 50),
          text: typeof obj.text === "string" ? obj.text : "",
          ts: typeof obj.ts === "string" ? obj.ts : (obj.time ? new Date(obj.time).toISOString() : new Date().toISOString()),
        }));

      // sort by time ascending
      arr.sort((a, b) => (new Date(a.ts) - new Date(b.ts)));

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ list: arr });
    }

    // --- POST: add comment ---
    if (req.method === "POST") {
      const contentType = req.headers["content-type"] || "";
      let body = {};
      if (contentType.includes("application/json")) {
        try {
          // در Next.js 13+ ممکن است مستقیم req.body باشد
          body = req.body ?? {};
        } catch {
          body = {};
        }
      } else {
        body = req.body || {};
      }

      let { book: bookInBody, text, dev, name, ts } = body || {};
      if (!bookInBody) bookInBody = book; // fallback to query param

      text = (typeof text === "string" ? text.trim() : "");
      if (!bookInBody || !text) {
        return res.status(400).json({ error: "Bad request: missing book or text" });
      }

      const doc = {
        id: "cmt_" + Math.random().toString(36).slice(2),
        dev: String(dev || ""),
        name: String(name || "کاربر ناشناس").slice(0, 50),
        text: text.slice(0, 1500),
        ts: typeof ts === "string" ? ts : new Date().toISOString(),
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
        return res.status(500).json({ error: "Upstash rpush error", details: t });
      }

      // keep only last 1000 comments
      await fetch(`${url}/ltrim/${listKey}/0/999`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, doc });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Server error in book-comments", details: String(e) });
  }
}
