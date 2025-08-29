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

    // انتخاب کلید: پیش‌فرض laan (برای سازگاری با لعن‌شمار فعلی)
    const raw = (req.query?.key || "laan").toString().toLowerCase();
    const safe = raw.replace(/[^a-z0-9_-]/g, ""); // کمی سفت‌گیری برای امنیت
    const redisKey = `global:counter:${safe || "laan"}`;

    if (req.method === "GET") {
      const r = await fetch(`${url}/get/${encodeURIComponent(redisKey)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      let value = 0;
      if (r.ok) {
        const data = await r.json();
        value = parseInt(data?.result, 10) || 0;
      }
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ value });
    }

    if (req.method === "POST") {
      const inc = 1;
      const r = await fetch(
        `${url}/incrby/${encodeURIComponent(redisKey)}/${inc}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      if (!r.ok) {
        const t = await r.text();
        return res.status(500).json({ error: "Upstash incr error", details: t });
      }
      const data = await r.json();
      const value = typeof data.result === "number" ? data.result : 0;
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ value });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error global-counter", details: String(err) });
  }
}
