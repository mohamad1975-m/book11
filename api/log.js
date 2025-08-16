export default async function handler(req, res) {
  try {
    const { slug = "index" } = req.query || {};
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({ error: "Missing Upstash config" });
    }

    // از body می‌گیریم: UA و UA-CH (در صورت وجود)
    let body = {};
    try {
      body = await (req.json ? req.json() : new Promise((r) => {
        let data = ""; req.on("data", c => data += c);
        req.on("end", () => { try{ r(JSON.parse(data||"{}")); } catch{ r({}) } });
      }));
    } catch {
      body = {};
    }

    const time = new Date().toISOString();
    const ua = req.headers["user-agent"] || body.ua || "unknown";
    const uaCH = body.uaCH || null;      // اطلاعات دقیق‌تر از کلاینت (اختیاری)

    // لاگ را ذخیره می‌کنیم
    const log = { time, slug, ua, uaCH };

    await fetch(`${url}/lpush/logs:${slug}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(log),
    });

    // 500 رکورد آخر
    await fetch(`${url}/ltrim/logs:${slug}/0/499`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}
