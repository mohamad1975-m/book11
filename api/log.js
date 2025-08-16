export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { slug } = req.query || {};
    const { ua } = req.body || {};

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({
        error: "Missing Upstash config (set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel).",
      });
    }

    // شیء لاگ جدید
    const logEntry = {
      slug: slug || "index",
      ua: ua || "-",
      time: Date.now(),
    };

    // ذخیره در یک کلید ثابت
    const r = await fetch(`${url}/lpush/logs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(logEntry),
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(500).json({ error: "Upstash error", details: txt });
    }

    // نگه داشتن فقط 200 تا آخرین بازدید
    await fetch(`${url}/ltrim/logs/0/199`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.status(200).json({ logged: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}
