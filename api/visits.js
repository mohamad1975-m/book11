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

    // شمارنده
    const r = await fetch(`${url}/incr/pageviews:${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(500).json({ error: "Upstash error", details: txt });
    }

    const data = await r.json(); // { result: number }
    const value = typeof data.result === "number" ? data.result : data;

    // ---- بخش لاگ بازدید ----
    const ua = req.headers["user-agent"] || "unknown";
    const now = new Date().toISOString();

    const parsed =
      (/Android|iPhone|iPad|Windows|Mac OS X|Linux/i.exec(ua)?.[0] ||
        "Other") +
      " - " +
      (/Edg|Chrome|Safari|Firefox/i.exec(ua)?.[0] || "Other");

    const log = { time: now, ua, parsed };

    // ذخیره مستقیم (بدون آرایه اضافه!)
    await fetch(`${url}/lpush/logs:${slug}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(log),
    });

    // فقط 500 رکورد آخر نگه داریم
    await fetch(`${url}/ltrim/logs:${slug}/0/499`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // -------------------------

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ value });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error", details: String(err) });
  }
}
