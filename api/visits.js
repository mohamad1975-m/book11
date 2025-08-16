import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export default async function handler(req, res) {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "slug required" });

  const key = `visits:${slug}`;

  // افزایش شمارنده
  const count = await redis.incr(key);

  res.status(200).json({ value: count });
}
