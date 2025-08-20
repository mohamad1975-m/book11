export default async function handler(req, res) {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({
        error: "Upstash config missing. Set UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN in Vercel."
      });
    }

    if (req.method === 'GET') {
      const { book } = req.query || {};
      if (!book) return res.status(400).json({ error: 'Missing book param' });

      // get current count
      const getRes = await fetch(`${url}/get/downloads:${book}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });

      let value = 0;
      if (getRes.ok) {
        const data = await getRes.json(); // {result: "number" or null}
        value = parseInt(data?.result, 10) || 0;
      }

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ value });
    }

    if (req.method === 'POST') {
      const { book, inc = 1 } = req.body || {};
      if (!book) return res.status(400).json({ error: 'Missing book' });

      const incrRes = await fetch(`${url}/incrby/downloads:${book}/${inc}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });

      if (!incrRes.ok) {
        const t = await incrRes.text();
        return res.status(500).json({ error: "Upstash incr error", details: t });
      }
      const d = await incrRes.json(); // { result: number }
      const value = typeof d.result === "number" ? d.result : 0;

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ value });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    return res.status(500).json({ error: 'Server error downloads', details: String(err) });
  }
}
