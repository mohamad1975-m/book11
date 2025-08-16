import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { slug } = req.body;
    const log = {
      slug,
      ua: req.headers["user-agent"] || "unknown",
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      time: new Date().toISOString()
    };

    await redis.lpush("logs", JSON.stringify(log));
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    const logs = await redis.lrange("logs", 0, 50);
    return res.status(200).json(logs.map(l => JSON.parse(l)));
  }

  res.status(405).end();
}
