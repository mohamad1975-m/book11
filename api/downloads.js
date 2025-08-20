// pages/api/downloads.js
export default async function handler(req, res) {
  try {
    const { id = "unknown" } = req.query || {}; // id کتاب

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({
        error:
          "Missing Upstash config (set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel).",
      });
    }

    // فقط وقتی که کاربر دکمه‌ی دانلود رو بزنه باید +1 بشه
    if (req.method === "POST") {
      const incr = await fetch(`${url}/incr/downloads:${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!incr.ok) {
        const t = await incr.text();
        return res.status(500).json({ error: "Upstash incr error", details: t });
      }

      const incrData = await incr.json();
      const value =
        typeof incrData.result === "number" ? incrData.result : 0;

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ value });
    }

    // اگر فقط بخوای مقدار فعلی رو بخونی (GET request)
    if (req.method === "GET") {
      const getRes = await fetch(`${url}/get/downloads:${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!getRes.ok) {
        const t = await getRes.text();
        return res.status(500).json({ error: "Upstash get error", details: t });
      }

      const getData = await getRes.json();
      const value = parseInt(getData.result || "0", 10);

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ value });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error", details: String(err) });
  }
}
