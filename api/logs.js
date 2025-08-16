export default async function handler(req, res) {
  try {
    const { slug = "index" } = req.query || {};

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({
        error:
          "Missing Upstash config (set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel).",
      });
    }

    // آخرین 100 لاگ رو بگیر (جدیدترین‌ها چون lpush می‌زنیم)
    const r = await fetch(`${url}/lrange/logs:${slug}/0/99`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!r.ok) {
      const txt = await r.text();
      return res
        .status(500)
        .json({ error: "Upstash error", details: txt });
    }

    const data = await r.json(); // { result: [...] }
    const logs = (data.result || []).map((x) => {
      try {
        return JSON.parse(x);
      } catch {
        return { raw: x };
      }
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ logs });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error", details: String(err) });
  }
}
