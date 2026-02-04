const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3003;
const DIR = __dirname;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
};

http.createServer((req, res) => {
  let file = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(DIR, file);
  const ext = path.extname(filePath);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Tiny Fangs Classic running on http://localhost:${PORT}`));
