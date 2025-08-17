import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'comments.json');

function readComments() {
  if (!fs.existsSync(filePath)) return [];
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data || '[]');
}

function saveComments(comments) {
  fs.writeFileSync(filePath, JSON.stringify(comments, null, 2));
}

export default function handler(req, res) {
  const { method, query, body } = req;

  if (method === 'GET') {
    // حالت ادمین
    if (query.admin && query.password === process.env.ADMIN_PASSWORD) {
      return res.status(200).json(readComments());
    }
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (method === 'POST') {
    const comments = readComments();
    const newComment = {
      id: Date.now().toString(),
      book: body.book,
      text: body.text
    };
    comments.push(newComment);
    saveComments(comments);
    return res.status(201).json(newComment);
  }

  if (method === 'DELETE') {
    if (query.password !== process.env.ADMIN_PASSWORD) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const comments = readComments().filter(c => c.id !== query.id);
    saveComments(comments);
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  res.status(405).end(`Method ${method} Not Allowed`);
}
