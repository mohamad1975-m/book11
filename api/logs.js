// pages/api/logs.js

let logs = []; // ذخیره لاگ‌ها در حافظه موقت (هر بار ری‌دیپلوی پاک میشه)

export default function handler(req, res) {
  if (req.method === 'POST') {
    const { slug } = req.body;

    const newLog = {
      slug: slug || 'unknown',
      time: Date.now(), // زمان دقیق
      ua: req.headers['user-agent'] || 'unknown',
    };

    logs.unshift(newLog); // آخرین لاگ بیاد بالا
    res.status(200).json({ message: 'Log saved', log: newLog });
  }

  else if (req.method === 'GET') {
    res.status(200).json({ logs });
  }

  else {
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
