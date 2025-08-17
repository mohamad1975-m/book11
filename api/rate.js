// pages/api/rate.js
export default async function handler(req, res) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      return res.status(500).json({ error: "Missing Upstash credentials" });
    }
  
    const { bookId } = req.method === 'GET' ? req.query : (req.body || {});
    if (!bookId || typeof bookId !== 'string') {
      return res.status(400).json({ error: 'bookId is required' });
    }
  
    try {
      if (req.method === 'GET') {
        // 🔹 دریافت میانگین و تعداد امتیازات
        const [cntRes, sumRes] = await Promise.all([
          fetch(`${url}/get/ratings:count:${bookId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${url}/get/ratings:sum:${bookId}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
  
        const cntJson = await cntRes.json();
        const sumJson = await sumRes.json();
  
        const count = Number(cntJson?.result || 0);
        const sum = Number(sumJson?.result || 0);
        const average = count > 0 ? (sum / count) : 0;
  
        return res.status(200).json({ count, average });
      }
  
      if (req.method === 'POST') {
        const { rating, deviceId } = req.body || {};
        const r = Number(rating);
        if (!r || r < 1 || r > 5) {
          return res.status(400).json({ error: 'rating must be 1..5' });
        }
        if (!deviceId) {
          return res.status(400).json({ error: "deviceId is required" });
        }
  
        // جلوگیری از تکرار امتیازدهی برای هر دستگاه
        const check = await fetch(`${url}/sismember/ratings:users:${bookId}/${deviceId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const checkJson = await check.json();
        if (checkJson.result === 1) {
          // قبلاً رای داده
          const [cntRes, sumRes] = await Promise.all([
            fetch(`${url}/get/ratings:count:${bookId}`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${url}/get/ratings:sum:${bookId}`, { headers: { Authorization: `Bearer ${token}` } }),
          ]);
          const cntJson = await cntRes.json();
          const sumJson = await sumRes.json();
          const count = Number(cntJson?.result || 0);
          const sum = Number(sumJson?.result || 0);
          const average = count > 0 ? (sum / count) : 0;
          return res.status(200).json({ ok: false, alreadyRated: true, count, average });
        }
  
        // ثبت رای جدید: SADD + INCR + INCRBYFLOAT
        const addUser = await fetch(`${url}/sadd/ratings:users:${bookId}/${deviceId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await addUser.json();
  
        const incrCnt = await fetch(`${url}/incr/ratings:count:${bookId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const incrSum = await fetch(`${url}/incrbyfloat/ratings:sum:${bookId}/${r}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
  
        const cntJson = await incrCnt.json();
        const sumJson = await incrSum.json();
        const count = Number(cntJson?.result || 0);
        const sum = Number(sumJson?.result || 0);
        const average = count > 0 ? (sum / count) : 0;
  
        return res.status(200).json({ ok: true, count, average });
      }
  
      return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
      return res.status(500).json({ error: "Server error", details: String(e) });
    }
  }
  