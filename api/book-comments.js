export default async function handler(req, res) {
  try {
    const url   = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({
        error:
          "Missing Upstash config. Set UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN in Vercel.",
      });
    }

    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const key = `comments:${slug}`;

    // ---------- GET -> list ----------
    if (req.method === "GET") {
      const r = await fetch(`${url}/lrange/${key}/0/-1`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!r.ok) {
        const t = await r.text();
        return res.status(500).json({ error: "Upstash lrange error", details: t });
      }
      const data = await r.json();
      const arr = Array.isArray(data?.result) ? data.result : [];

      const list = arr
        .map((s) => {
          try { return JSON.parse(s); } catch { return null; }
        })
        .filter(Boolean)
        .map((o) => ({
          id: String(o.id || ""),
          // اگر به هر دلیل text نبود یا null بود، رشتهٔ خالی
          text: typeof o.text === "string" ? o.text : "",
          ts: Number(o.ts) || Date.now(),
        }));

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ list });
    }

    // ---------- POST -> add ----------
    if (req.method === "POST") {
      let body = req.body;

      // اگر بدنهٔ خام به‌صورت رشتهٔ JSON رسیده
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch {
          // اگر رشته بود ولی JSON نبود، یک شیء خالی می‌گذاریم
          body = {};
        }
      }

      // بعضی دیپلوی‌ها body را undefined یا خالی می‌دهند؛
      // متن را از چند مسیر سعی می‌کنیم بیرون بکشیم:
      let textCandidate = "";
      if (body && typeof body === "object" && body.text != null) {
        textCandidate = String(body.text);
      } else if (body && typeof body === "object" && body.t != null) {
        textCandidate = String(body.t);
      } else if (typeof req.query.text === "string") {
        // آخرین راه: از کوئری (برای تست یا اگر کلاینت به مشکل خورد)
        textCandidate = req.query.text;
      }

      // حذف فاصله‌های اضافی
      const text = (textCandidate || "").trim();
      if (!text) {
        // اگر باز هم خالی بود، خطا بده که بفهمیم چرا ذخیره خالی می‌شده
        return res.status(400).json({ error: "Empty text" });
      }

      const doc = {
        id: "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
        text,               // دقیقا همان‌طور که آمده ذخیره می‌کنیم
        ts: Date.now(),
      };

      // Upstash REST expects an array of items for RPUSH
      const payload = [JSON.stringify(doc)];
      const p = await fetch(`${url}/rpush/${key}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!p.ok) {
        const t = await p.text();
        return res.status(500).json({ error: "Upstash rpush error", details: t });
      }

      // نگهداری 1000 مورد آخر (دلخواه)
      await fetch(`${url}/ltrim/${key}/0/999`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return res.status(200).json({ ok: true, doc });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Server error book-comments", details: String(e) });
  }
}
