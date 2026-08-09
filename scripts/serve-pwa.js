const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'dist', 'client');
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png'
};

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, 'index.html')) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(root, 'index.html'), (fallbackError, fallback) => {
        if (fallbackError) return response.writeHead(404).end('Not found');
        response.writeHead(200, { 'Content-Type': types['.html'], 'Cache-Control': 'no-cache' });
        response.end(fallback);
      });
      return;
    }
    response.writeHead(200, {
      'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': filePath.endsWith('service-worker.js') ? 'no-cache' : 'public, max-age=300'
    });
    response.end(data);
  });
});

server.listen(port, '127.0.0.1', () => console.log(`PWA preview: http://127.0.0.1:${port}`));
