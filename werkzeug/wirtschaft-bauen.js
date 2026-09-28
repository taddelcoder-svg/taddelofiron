'use strict';
// Epochen – verteilt Bevoelkerung, Fabriken, Infrastruktur und Rohstoffe 1936 auf die Provinzen
// und schreibt sie in daten/epochen/1936/welt.json (Feld "wirtschaft").
//
//   node werkzeug/wirtschaft-bauen.js      (nach provinzen-bauen.js)
//
// Gewichtung: Einwohner der Staedte aus Natural Earth (populated places) je Provinz + Flaeche.
const fs = require('fs');
const path = require('path');
const W = require('./wirtschaft-1936');

const DATEN = path.join(__dirname, '..', 'daten');
const prov = JSON.parse(fs.readFileSync(path.join(DATEN, 'provinzen.json'), 'utf8'));
const weltDatei = path.join(DATEN, 'epochen', '1936', 'welt.json');
const welt = JSON.parse(fs.readFileSync(weltDatei, 'utf8'));
const orte = JSON.parse(fs.readFileSync(path.join(__dirname, 'quellen', 'orte.geojson'), 'utf8')).features;

// ---------- Provinz-Ringe dekodieren ----------
const [sx, sy] = prov.transform.scale, [tx, ty] = prov.transform.translate;
const boegen = prov.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
const ring = idx => { const out = []; for (const i of idx){ const a = i < 0 ? boegen[~i].slice().reverse() : boegen[i]; out.push(...(out.length ? a.slice(1) : a)); } return out; };
const P = prov.provinzen.map(p => {
  const polys = p.g.map(poly => poly.map(ring));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of polys) for (const [x, y] of poly[0]){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { ...p, polys, box:[x0, y0, x1, y1] };
});
function imRing(x, y, r){
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++){
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const drin = (x, y, p) => x >= p.box[0] && x <= p.box[2] && y >= p.box[1] && y <= p.box[3] &&
  p.polys.some(poly => imRing(x, y, poly[0]) && !poly.slice(1).some(h => imRing(x, y, h)));

// ---------- Staedte zuordnen ----------
const stadtPop = new Float64Array(P.length);
let ohne = 0;
for (const f of orte){
  const [x, y] = f.geometry.coordinates, pop = f.properties.pop_max || 0;
  let i = P.findIndex(p => drin(x, y, p));
  if (i < 0){ // Kuestenstaedte knapp ausserhalb: naechster Provinzmittelpunkt
    let bd = 1.5; for (let j = 0; j < P.length; j++){ const d = Math.hypot(P[j].l[0] - x, P[j].l[1] - y); if (d < bd){ bd = d; i = j; } }
  }
  if (i < 0){ ohne++; continue; }
  stadtPop[i] += pop;
}

// ---------- Kernland je Staat ----------
const besitz = welt.besitz;
function kernland(tag){
  const hs = welt.staaten[tag].hauptstadt, out = new Set([hs]), st = [hs];
  while (st.length){ const p = st.pop(); for (const n of P[p].nb) if (!out.has(n) && besitz[n] === tag){ out.add(n); st.push(n); } }
  return out;
}

const n = P.length;
const bev = new Float64Array(n), zf = new Int16Array(n), mf = new Int16Array(n), infra = new Int8Array(n);
const gewicht = i => Math.pow(stadtPop[i] * 0.35 + P[i].a * 8, 0.95);
// Grundschaetzung fuer alle Provinzen (1936 ≈ 35 % der heutigen Stadtbevoelkerung + laendliche Dichte)
for (let i = 0; i < n; i++) bev[i] = stadtPop[i] * 0.35 + P[i].a * 8;

function verteilen(ids, summe, gew){ // ganze Zahlen, groesster Rest
  const g = ids.map(gew), gs = g.reduce((a, b) => a + b, 0) || 1;
  const roh = g.map(x => x / gs * summe), ganz = roh.map(Math.floor);
  let rest = summe - ganz.reduce((a, b) => a + b, 0);
  roh.map((x, k) => [x - ganz[k], k]).sort((a, b) => b[0] - a[0]).slice(0, rest).forEach(([, k]) => ganz[k]++);
  return ganz;
}

for (const tag of Object.keys(welt.staaten)){
  const kern = [...kernland(tag)], alle = besitz.map((t, i) => t === tag ? i : -1).filter(i => i >= 0);
  const kolonie = alle.filter(i => !kern.includes(i));
  const w = W.STAATEN[tag];
  const entw = w ? w[3] : 1;
  if (w){
    const s = kern.reduce((a, i) => a + bev[i], 0) || 1;
    for (const i of kern) bev[i] *= w[0] * 1e6 / s;
    // Industrie konzentriert sich in den grossen Staedten
    verteilen(kern, w[1], i => Math.pow(gewicht(i), 1.3)).forEach((v, k) => zf[kern[k]] = v);
    verteilen(kern, w[2], i => Math.pow(gewicht(i), 1.3)).forEach((v, k) => mf[kern[k]] = v);
  } else {
    const pop = kern.reduce((a, i) => a + bev[i], 0);
    verteilen(kern, Math.round(pop / 6e6), i => gewicht(i)).forEach((v, k) => zf[kern[k]] = v);
  }
  // Kolonien: kaum Industrie
  const kpop = kolonie.reduce((a, i) => a + bev[i], 0);
  if (kolonie.length) verteilen(kolonie, Math.round(kpop / 15e6), i => gewicht(i)).forEach((v, k) => zf[kolonie[k]] = v);
  // Infrastruktur 1–5 aus Entwicklung und Dichte
  const maxG = Math.max(1, ...kern.map(gewicht));
  for (const i of kern) infra[i] = Math.max(1, Math.min(5, Math.round(entw * (0.55 + 0.6 * Math.sqrt(gewicht(i) / maxG)))));
  for (const i of kolonie) infra[i] = Math.max(1, Math.min(3, Math.round(1 + gewicht(i) / 2e6)));
}

// ---------- Rohstoffe ----------
const roh = {};
for (const [art, gebiete] of Object.entries(W.ROHSTOFFE)){
  const a = new Int16Array(n);
  for (const [x0, y0, x1, y1, menge] of gebiete){
    let ids = P.filter(p => p.l[0] >= x0 && p.l[0] <= x1 && p.l[1] >= y0 && p.l[1] <= y1).map(p => p.id !== undefined ? p.id : P.indexOf(p));
    if (!ids.length){
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      let bi = 0, bd = Infinity; P.forEach((p, i) => { const d = Math.hypot(p.l[0] - cx, p.l[1] - cy); if (d < bd){ bd = d; bi = i; } });
      ids = [bi];
    }
    verteilen(ids, menge, i => 1 + gewicht(i) / 1e6).forEach((v, k) => a[ids[k]] += v);
  }
  roh[art] = Array.from(a);
}

// ---------- Festungen 1936: Maginot-Linie, tschechische Grenzbefestigung, Mannerheim-Linie ----------
const fest = new Int8Array(n);
const grenzt = (i, tags) => P[i].nb.some(j => tags.includes(besitz[j]));
for (let i = 0; i < n; i++){
  const t = besitz[i];
  if (t === 'FRA' && grenzt(i, ['GER'])) fest[i] = 3;
  else if (t === 'FRA' && grenzt(i, ['ITA', 'SWI', 'BEL'])) fest[i] = 1;
  else if (t === 'CZE' && grenzt(i, ['GER', 'AUT', 'HUN'])) fest[i] = 2;
  else if (t === 'FIN' && grenzt(i, ['SOV']) && P[i].l[1] < 62) fest[i] = 2;
  else if ((t === 'BEL' || t === 'GER') && grenzt(i, t === 'BEL' ? ['GER'] : ['FRA'])) fest[i] = 1;
}

welt.wirtschaft = {
  festung:Array.from(fest),
  bev:Array.from(bev, x => Math.round(x / 1000)), // Tausend
  zf:Array.from(zf), mf:Array.from(mf), infra:Array.from(infra),
  stahl:roh.stahl, oel:roh.oel, gummi:roh.gummi
};
for (const tag of Object.keys(welt.staaten)) welt.staaten[tag].wehrgesetz = W.STAATEN[tag] ? W.STAATEN[tag][4] : 1;
fs.writeFileSync(weltDatei, JSON.stringify(welt));

// Kontrolle
const summe = (arr, tag) => arr.reduce((a, v, i) => a + (besitz[i] === tag ? v : 0), 0);
for (const tag of ['GER', 'SOV', 'USA', 'ENG', 'FRA', 'ITA', 'JAP', 'HOL', 'RAJ', 'CHI']){
  console.log(tag.padEnd(4), 'Bev', (summe(welt.wirtschaft.bev, tag) / 1000).toFixed(0) + ' Mio', 'ZF', summe(welt.wirtschaft.zf, tag), 'MF', summe(welt.wirtschaft.mf, tag),
    'Stahl', summe(roh.stahl, tag), 'Öl', summe(roh.oel, tag), 'Gummi', summe(roh.gummi, tag));
}
console.log('Staedte ohne Provinz:', ohne);
