// /api/counters.js
export default async function handler(req, res) {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      return res.status(500).json({ error: "Upstash config missing" });
    }
    const headers = { Authorization: `Bearer ${token}` };
    const valid = new Set(["shares", "buys"]);
    const keyFor = (type, book) => `counter:${type}:${book}`;

    if (req.method === "GET") {
      const { type, book } = req.query;
      if (!valid.has(type) || !book) {
        return res.status(400).json({ error: "type(shares|buys) and book required" });
      }
      const key = keyFor(type, book);
      const r = await fetch(`${url}/get/${key}`, { headers, cache: "no-store" });
      let value = 0;
      if (r.ok) {
        const data = await r.json();
        value = parseInt(data?.result, 10) || 0;
      }
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ value });
    }

    if (req.method === "POST") {
      const { type, book, inc } = req.body || {};
      if (!valid.has(type) || !book) {
        return res.status(400).json({ error: "type(shares|buys) and book required" });
      }
      const by = Number.isFinite(inc) ? inc : 1;
      const key = keyFor(type, book);
      const r = await fetch(`${url}/incrby/${key}/${by}`, { headers, cache: "no-store" });
      if (!r.ok) {
        const t = await r.text();
        return res.status(500).json({ error: "redis error", details: t });
      }
      const data = await r.json();
      const value = typeof data.result === "number" ? data.result : 0;
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ value });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "server error", details: String(e) });
  }
}
