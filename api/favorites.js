// api/favorites.js
export default async function handler(req, res) {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      return res.status(500).json({ error: "Upstash config missing" });
    }

    const headers = { Authorization: `Bearer ${token}` };
    const getKey = (book) => `favorites:${book}:users`;

    if (req.method === 'GET') {
      const { book, device } = req.query;
      if (!book) return res.status(400).json({ error: "book required" });
      const key = getKey(book);

      // count
      const rCount = await fetch(`${url}/scard/${key}`, { headers, cache: 'no-store' });
      const count = rCount.ok ? (await rCount.json())?.result ?? 0 : 0;

      // is member?
      let isFav = false;
      if (device) {
        const rMem = await fetch(`${url}/sismember/${key}/${encodeURIComponent(device)}`, { headers, cache: 'no-store' });
        if (rMem.ok) isFav = Boolean((await rMem.json())?.result);
      }

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ count, isFav });
    }

    if (req.method === 'POST') {
      const { book, device, op } = req.body || {};
      if (!book || !device || !['add','remove'].includes(op)) {
        return res.status(400).json({ error: "book, device, op('add'|'remove') required" });
      }
      const key = getKey(book);

      const cmd = op === 'add' ? 'sadd' : 'srem';
      const rMut = await fetch(`${url}/${cmd}/${key}/${encodeURIComponent(device)}`, { headers, cache: 'no-store' });
      if (!rMut.ok) {
        const t = await rMut.text();
        return res.status(500).json({ error: "redis error", details: t });
      }

      const rCount = await fetch(`${url}/scard/${key}`, { headers, cache: 'no-store' });
      const count = rCount.ok ? (await rCount.json())?.result ?? 0 : 0;

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ count, isFav: op === 'add' });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "server error", details: String(e) });
  }
}
