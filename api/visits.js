let count = 0;

export default function handler(req, res) {
  count++;
  res.status(200).json({ visits: count });
}
