export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { slug = "index" } = req.query || {};
    const { ua } = req.body || {};

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({
        error:
          "Missing Upstash config (set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel).",
      });
    }

    const logEntry = {
      slug,
      ua: ua || null,
      time: Date.now(),
    };

    // ذخیره در لیست Redis
    const r = await fetch(`${url}/lpush/logs:${slug}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(logEntry),
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(500).json({ error: "Upstash error", details: txt });
    }

    // نگه داشتن فقط 50 لاگ آخر
    await fetch(`${url}/ltrim/logs:${slug}/0/49`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.status(200).json({ logged: true });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error", details: String(err) });
  }
}
