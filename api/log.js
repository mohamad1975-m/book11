export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { slug = "index", ua } = JSON.parse(req.body || "{}");

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({
        error:
          "Missing Upstash config (set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel).",
      });
    }

    const log = {
      time: new Date().toISOString(),
      ua,
      parsed: parseUA(ua),
    };

    // push log into redis
    const r = await fetch(`${url}/lpush/logs:${slug}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([JSON.stringify(log)]),
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(500).json({ error: "Upstash error", details: txt });
    }

    return res.status(200).json({ success: true, log });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error", details: String(err) });
  }
}

function parseUA(ua) {
  if (!ua) return "نامشخص - نامشخص";
  if (ua.includes("Windows")) return "Windows - " + (ua.includes("Chrome") ? "Chrome" : "Other");
  if (ua.includes("Android")) return "Android - " + (ua.includes("Chrome") ? "Chrome" : "Other");
  if (ua.includes("iPhone")) return "iOS - " + (ua.includes("Safari") ? "Safari" : "Other");
  return "نامشخص - نامشخص";
}
