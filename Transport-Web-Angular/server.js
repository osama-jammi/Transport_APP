/* ============================================================
   Serveur statique de production pour l'app Angular compilée.
   Sert dist/transport-web et applique un fallback SPA :
   toute route inconnue (y compris le callback Keycloak
   /?state=...&code=...) renvoie index.html.
   C'est ce fallback qui corrige le bug "Not found: /?state=..."
   de l'ancienne interface HTML.
   Lancer : npm run build:prod && npm run serve:prod
   ============================================================ */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'dist', 'transport-web');

const MIME = {
  '.html': 'text/html;charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json'
};

http.createServer((req, res) => {
  // On ignore la query string (?state=...&code=...) pour résoudre le fichier
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  // Sécurité : empêcher la traversée de répertoire
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fallback SPA : route Angular inconnue -> index.html
      fs.readFile(path.join(ROOT, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(404); res.end('Build introuvable. Lancez: npm run build:prod'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
        res.end(html);
      });
      return;
    }
    const mime = MIME[path.extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('');
  console.log('  ✅  Transport Admin (prod)  →  http://localhost:' + PORT);
  console.log('  📁  Racine servie           →  ' + ROOT);
  console.log('');
});
