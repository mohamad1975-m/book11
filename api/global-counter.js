export default async function handler(req, res) {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      return res.status(500).json({
        error: "Upstash config missing. Set UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN in Vercel."
      });
    }

    const key = "global:counter:salawat"; // global shared key

    if (req.method === "GET") {
      const r = await fetch(`${url}/get/${key}`, {
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
      const r = await fetch(`${url}/incrby/${key}/${inc}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
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
    return res.status(500).json({ error: "Server error global-counter", details: String(err) });
  }
}
