'use strict';
// Epochen – Server: liefert Spiel und Kartendaten aus (gzip, im Speicher zwischengespeichert).
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const zugang = require('./zugang')({ titel:'Epochen' });

const PORT = Number(process.env.PORT) || 10500;
const TYPEN = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml'
};
const OEFFENTLICH = path.join(__dirname, 'public');
const DATEN = path.join(__dirname, 'daten');

// Gzip-Cache: Datei -> { mtime, roh, gz }
const cache = new Map();
function laden(voll){
  const st = fs.statSync(voll);
  const c = cache.get(voll);
  if (c && c.mtime === st.mtimeMs) return c;
  const roh = fs.readFileSync(voll);
  const neu = { mtime:st.mtimeMs, roh, gz:zlib.gzipSync(roh, { level:9 }) };
  cache.set(voll, neu);
  return neu;
}
function senden(req, res, voll, cacheKopf){
  let d;
  try { d = laden(voll); } catch { res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); return res.end('Nicht gefunden'); }
  const kopf = { 'Content-Type':TYPEN[path.extname(voll)] || 'application/octet-stream', 'Cache-Control':cacheKopf, 'Vary':'Accept-Encoding' };
  if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')){
    kopf['Content-Encoding'] = 'gzip';
    res.writeHead(200, kopf); return res.end(d.gz);
  }
  res.writeHead(200, kopf); res.end(d.roh);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method !== 'GET' && req.method !== 'POST'){ res.writeHead(405); return res.end(); }
  if (req.method === 'GET' && url.pathname.startsWith('/datenschutz')) return senden(req, res, path.join(__dirname, 'datenschutz.html'), 'no-cache');
  if (req.method === 'GET' && url.pathname === '/healthz'){ res.writeHead(200, { 'Content-Type':'application/json' }); return res.end('{"ok":true}'); }
  if (zugang.pruefen(req, res)) return;
  if (req.method !== 'GET'){ res.writeHead(405); return res.end(); }
  if (url.pathname === '/') return senden(req, res, path.join(OEFFENTLICH, 'index.html'), 'no-cache');
  // Spieldateien: nur einfache Namen aus public/
  const datei = /^\/([\w-]+\.(?:js|css|html|svg))$/.exec(url.pathname);
  if (datei) return senden(req, res, path.join(OEFFENTLICH, datei[1]), 'no-cache');
  // Kartendaten: /daten/provinzen.json, /daten/epochen/1936/welt.json
  const daten = /^\/daten\/((?:epochen\/\d{1,4}\/)?[\w-]+\.json)$/.exec(url.pathname);
  if (daten) return senden(req, res, path.join(DATEN, daten[1]), 'no-cache');
  res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
  res.end('Nicht gefunden');
});

server.listen(PORT, () => console.log(`Epochen läuft auf http://localhost:${PORT}`));
