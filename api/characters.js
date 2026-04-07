const fs = require('fs/promises');
const path = require('path');

const ROOT_FILE = path.join(process.cwd(), 'characters.txt');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const data = await fs.readFile(ROOT_FILE, 'utf8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(200).send(data);
    } catch {
      res.status(500).send('Failed to read characters.txt');
    }
    return;
  }

  if (req.method === 'PUT') {
    // Vercel serverless functions have ephemeral filesystem; writes are not persistent.
    res.status(501).json({
      error: 'Saving is not supported on Vercel deployment. Use local dev to edit characters.txt.',
    });
    return;
  }

  res.setHeader('Allow', 'GET, PUT');
  res.status(405).send('Method Not Allowed');
};
