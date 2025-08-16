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

    // 1) افزایش شمارنده بازدید
    const incr = await fetch(`${url}/incr/pageviews:${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!incr.ok) {
      const t = await incr.text();
      return res.status(500).json({ error: "Upstash incr error", details: t });
    }

    const incrData = await incr.json();
    const value = typeof incrData.result === "number" ? incrData.result : 0;

    // 2) ثبت لاگ بازدید
    let logged = false;
    let logError = null;
    try {
      const ua = req.headers["user-agent"] || "unknown";
      const now = new Date().toISOString();

      const os =
        (/Android|iPhone|iPad|Windows|Mac OS X|Linux/i.exec(ua)?.[0] ||
          "Other");
      const br =
        (/Edg|Chrome|Safari|Firefox/i.exec(ua)?.[0] || "Other");

      // رشته JSON به عنوان مقدار در لیست
      const logString = JSON.stringify({
        time: now,
        ua,
        parsed: `${os} - ${br}`,
      });

      // Upstash LPUSH expects array of values => ["value"]
      const pushRes = await fetch(`${url}/lpush/logs:${slug}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([logString]),
      });

      if (!pushRes.ok) {
        logError = await pushRes.text();
      } else {
        const pushed = await pushRes.json(); // {"result": new_length}
        logged = Number.isFinite(pushed?.result);
      }

      // نگه داشتن 500 مورد آخر
      await fetch(`${url}/ltrim/logs:${slug}/0/499`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      logError = String(e);
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ value, logged, logError });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error", details: String(err) });
  }
}
