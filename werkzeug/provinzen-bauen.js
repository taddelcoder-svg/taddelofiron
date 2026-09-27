'use strict';
// Epochen – baut die Weltprovinzen (daten/provinzen.json) und die Startlage 1936
// (daten/epochen/1936/welt.json) aus Natural Earth (Admin-1) + historical-basemaps.
//
//   node werkzeug/provinzen-bauen.js
//
// Ablauf: Regionen vereinfachen -> Besitzer 1936 zuordnen (evtl. entlang der Karte
// von 1938 zerschneiden) -> kleine Regionen zusammenlegen -> grosse Regionen teilen
// -> Topologie (gemeinsame Kanten) bauen und vereinfachen.
const fs = require('fs');
const path = require('path');
const mapshaper = require('mapshaper');
const pc = require('polygon-clipping');
const G36 = require('./grenzen-1936');
const { deutsch } = require('./namen');

const QUELLEN = path.join(__dirname, 'quellen');
const TMP = path.join(__dirname, 'tmp');
const DATEN = path.join(__dirname, '..', 'daten');
fs.mkdirSync(TMP, { recursive:true });
fs.mkdirSync(path.join(DATEN, 'epochen', '1936'), { recursive:true });

// ---------- Geometrie-Helfer ----------
const RAD = Math.PI / 180, R_ERDE = 6371.0088;
function ringFlaeche(r){ // km², sphaerisch (Vorzeichen egal)
  let s = 0;
  for (let i = 0, n = r.length; i < n - 1; i++){
    const [x1, y1] = r[i], [x2, y2] = r[i + 1];
    s += (x2 - x1) * RAD * (2 + Math.sin(y1 * RAD) + Math.sin(y2 * RAD));
  }
  return Math.abs(s * R_ERDE * R_ERDE / 2);
}
const polyFlaeche = p => p.reduce((s, r, i) => s + (i ? -1 : 1) * ringFlaeche(r), 0);
const mpFlaeche = mp => mp.reduce((s, p) => s + polyFlaeche(p), 0);
const alsMP = g => !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
function mpSchwerpunkt(mp){ // flaechengewichteter Mittelpunkt der Aussenringe
  let sx = 0, sy = 0, sa = 0;
  for (const p of mp){
    const r = p[0]; let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < r.length - 1; i++){
      const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
      a += f; cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f;
    }
    if (Math.abs(a) < 1e-12) continue;
    const fl = Math.abs(a / 2);
    sx += cx / (3 * a) * fl; sy += cy / (3 * a) * fl; sa += fl;
  }
  if (!sa){ const r = mp[0][0]; return r[0]; }
  return [sx / sa, sy / sa];
}
function mpBox(mp){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of mp) for (const [x, y] of p[0]){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
const boxUeberlapp = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
function imRing(x, y, r){
  let in_ = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++){
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) in_ = !in_;
  }
  return in_;
}
const imPoly = (x, y, p) => imRing(x, y, p[0]) && !p.slice(1).some(h => imRing(x, y, h));
const imMP = (x, y, mp) => mp.some(p => imPoly(x, y, p));
function distKm(a, b){
  const dl = (b[0] - a[0]) * RAD * Math.cos((a[1] + b[1]) / 2 * RAD), dp = (b[1] - a[1]) * RAD;
  return Math.hypot(dl, dp) * R_ERDE;
}
function sicher(fn, ...a){ try { return fn(...a); } catch (e){ console.warn('  Clipping-Fehler:', e.message); return []; } }

// Ziel-Provinzgroesse (km²) nach Weltgegend
function zielFlaeche(lon, lat){
  const in_ = (x0, x1, y0, y1) => lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1;
  if (in_(-25, 45, 34, 72)) return 30000;                           // Europa
  if (lat > 60 || lat < -45) return 260000;                          // Polargebiete
  if (in_(-17, 33, 16, 31) || in_(38, 56, 17, 30)) return 220000;    // Sahara, Arabien
  if (in_(115, 150, -32, -18)) return 260000;                        // Australien innen
  if (in_(100, 145, 20, 45) || in_(68, 92, 8, 32) || in_(30, 63, 29, 42) || in_(-10, 35, 30, 38)) return 60000;
  if (in_(-100, -65, 25, 50)) return 75000;                          // USA Osten
  return 130000;
}

async function ms(cmd){ await mapshaper.runCommands(cmd); }
const lesen = f => JSON.parse(fs.readFileSync(f, 'utf8'));

async function main(){
  const t0 = Date.now();
  // ---------- 1. Regionen vereinfachen ----------
  console.log('1. Admin-1 vereinfachen …');
  const A = path.join(TMP, 'a.geojson');
  await ms(`-i "${path.join(QUELLEN, 'admin1.geojson')}" -filter "adm0_a3 != 'ATA'" -filter-fields adm0_a3,name,name_de ` +
    `-simplify interval=800 keep-shapes -filter-islands min-area=60000000 remove-empty -o "${A}" force`);
  const admin = lesen(A).features;
  console.log('   Regionen:', admin.length);

  // ---------- 2. Besitzer 1936, Schnitte entlang 1938 ----------
  console.log('2. Besitzer 1936 zuordnen …');
  const alt = lesen(path.join(QUELLEN, 'world_1938.geojson')).features
    .filter(f => G36.NAMEN_1938[f.properties.NAME])
    .map(f => ({ tag:G36.NAMEN_1938[f.properties.NAME], mp:alsMP(f.geometry) }))
    .map(o => ({ ...o, box:mpBox(o.mp) }));
  const einheiten = [];
  const fehlend = new Set();
  for (const f of admin){
    const p = f.properties, adm0 = p.adm0_a3, key = adm0 + '/' + p.name;
    const mp = alsMP(f.geometry); if (!mp.length) continue;
    const name = deutsch(p.name_de || p.name || adm0, adm0);
    let besitzer = key in G36.REGION ? G36.REGION[key] : G36.LAND[adm0];
    if (besitzer === undefined){ fehlend.add(adm0); continue; }
    if (besitzer === null) continue;
    if (!(key in G36.REGION) && (G36.SCHNITT_LAENDER.has(adm0) || G36.SCHNITT_REGIONEN.has(key))){
      const box = mpBox(mp);
      let rest = mp; const teile = [];
      for (const a of alt){
        if (!boxUeberlapp(box, a.box)) continue;
        const s = sicher(pc.intersection, rest, a.mp);
        if (!s.length || mpFlaeche(s) < 30) continue;
        teile.push({ tag:a.tag, mp:s });
        rest = sicher(pc.difference, rest, a.mp);
        if (!rest.length) break;
      }
      if (!teile.length){ einheiten.push({ mp, adm0, name, besitzer, orig:p.name }); continue; }
      // Reststuecke (Luecken/Kuesten der alten Karte) gehen an den heutigen Besitzer
      if (rest.length && mpFlaeche(rest) > 1){
        const eigen = teile.find(t => t.tag === besitzer);
        if (eigen) eigen.mp = sicher(pc.union, eigen.mp, rest); else teile.push({ tag:besitzer, mp:rest });
      }
      for (const t of teile) einheiten.push({ mp:t.mp, adm0, name, besitzer:t.tag, orig:p.name });
    } else {
      einheiten.push({ mp, adm0, name, besitzer, orig:p.name });
    }
  }
  if (fehlend.size) console.warn('   Ohne Zuordnung:', [...fehlend].join(', '));
  console.log('   Einheiten:', einheiten.length);

  // ---------- 3. Topologie der Einheiten (Nachbarn) ----------
  console.log('3. Nachbarschaften …');
  const U = path.join(TMP, 'u.geojson'), UT = path.join(TMP, 'u.topojson'), UG = path.join(TMP, 'u2.geojson');
  fs.writeFileSync(U, JSON.stringify({ type:'FeatureCollection', features:einheiten.map((e, i) => ({
    type:'Feature', properties:{ uid:i }, geometry:{ type:'MultiPolygon', coordinates:e.mp } })) }));
  await ms(`-i "${U}" snap -clean -o "${UT}" format=topojson force -o "${UG}" format=geojson force`);
  const topo = lesen(UT), geo = lesen(UG);
  const obj = Object.values(topo.objects)[0];
  const kantenNutzer = new Map();
  const bogen = g => { const out = []; const lauf = x => Array.isArray(x) ? x.forEach(lauf) : out.push(x < 0 ? ~x : x); lauf(g.arcs || []); return out; };
  for (const g of obj.geometries){
    const uid = g.properties.uid;
    for (const a of bogen(g)){ if (!kantenNutzer.has(a)) kantenNutzer.set(a, new Set()); kantenNutzer.get(a).add(uid); }
  }
  const nachbarn = einheiten.map(() => new Set());
  for (const s of kantenNutzer.values()){ const l = [...s]; for (const a of l) for (const b of l) if (a !== b) nachbarn[a].add(b); }
  for (const f of geo.features){ const e = einheiten[f.properties.uid]; e.mp = alsMP(f.geometry); }
  for (const e of einheiten){ e.fl = mpFlaeche(e.mp); e.c = e.mp.length ? mpSchwerpunkt(e.mp) : [0, 0]; e.ziel = zielFlaeche(e.c[0], e.c[1]); }

  // ---------- 4. Kleine Einheiten zusammenlegen ----------
  console.log('4. Zusammenlegen …');
  const vater = einheiten.map((_, i) => i);
  const wurzel = i => { while (vater[i] !== i){ vater[i] = vater[vater[i]]; i = vater[i]; } return i; };
  const gFl = einheiten.map(e => e.fl);
  const gNb = nachbarn.map(s => new Set(s));
  const passt = (a, b) => einheiten[a].adm0 === einheiten[b].adm0 && einheiten[a].besitzer === einheiten[b].besitzer;
  let geaendert = true;
  while (geaendert){
    geaendert = false;
    const reihe = einheiten.map((_, i) => i).filter(i => wurzel(i) === i && einheiten[i].mp.length).sort((a, b) => gFl[a] - gFl[b]);
    for (const i of reihe){
      if (wurzel(i) !== i || gFl[i] >= 0.45 * einheiten[i].ziel) continue;
      let best = -1, bf = Infinity;
      for (const n0 of gNb[i]){
        const n = wurzel(n0); if (n === i || !passt(i, n)) continue;
        if (gFl[n] < bf){ bf = gFl[n]; best = n; }
      }
      if (best < 0 && gFl[i] < 0.25 * einheiten[i].ziel){ // Insel: naechste passende Gruppe
        let bd = 400;
        for (let j = 0; j < einheiten.length; j++){
          if (wurzel(j) !== j || j === i || !passt(i, j) || !einheiten[j].mp.length) continue;
          const d = distKm(einheiten[i].c, einheiten[j].c); if (d < bd){ bd = d; best = j; }
        }
      }
      if (best < 0 || gFl[i] + gFl[best] > 1.5 * einheiten[i].ziel && gFl[i] > 0.2 * einheiten[i].ziel) continue;
      const [gross, klein] = gFl[best] >= gFl[i] ? [best, i] : [i, best];
      vater[klein] = gross; gFl[gross] += gFl[klein];
      for (const n of gNb[klein]) gNb[gross].add(n);
      geaendert = true;
    }
  }
  const gruppen = new Map();
  einheiten.forEach((e, i) => { if (!e.mp.length) return; const w = wurzel(i); if (!gruppen.has(w)) gruppen.set(w, []); gruppen.get(w).push(i); });
  let provinzen = [];
  for (const [w, glieder] of gruppen){
    const mps = glieder.map(i => einheiten[i].mp);
    const mp = mps.length === 1 ? mps[0] : sicher(pc.union, ...mps);
    if (!mp.length) continue;
    const haupt = glieder.reduce((a, b) => einheiten[a].fl >= einheiten[b].fl ? a : b);
    const e = einheiten[haupt];
    provinzen.push({ mp, name:e.name, orig:e.orig, adm0:e.adm0, besitzer:e.besitzer });
  }
  console.log('   Gruppen:', provinzen.length);

  // ---------- 5. Grosse Provinzen teilen ----------
  console.log('5. Teilen …');
  const { Delaunay } = await import('d3-delaunay');
  const geteilt = [];
  let zufall = 12345; const rnd = () => (zufall = (zufall * 16807) % 2147483647) / 2147483647;
  const RICHTUNG = ['Ost', 'Nordost', 'Nord', 'Nordwest', 'West', 'Südwest', 'Süd', 'Südost'];
  for (const p of provinzen){
    const fl = mpFlaeche(p.mp), c = mpSchwerpunkt(p.mp), ziel = zielFlaeche(c[0], c[1]);
    const k = Math.min(14, Math.round(fl / ziel));
    if (fl < 1.7 * ziel || k < 2){ geteilt.push(p); continue; }
    const box = mpBox(p.mp), kos = Math.cos(c[1] * RAD);
    // Punkte in der Flaeche, gleichmaessig in km verteilt
    const pts = []; let versuche = 0;
    while (pts.length < k * 80 && versuche++ < 200000){
      const x = box[0] + rnd() * (box[2] - box[0]), y = box[1] + rnd() * (box[3] - box[1]);
      if (imMP(x, y, p.mp)) pts.push([x * kos, y]);
    }
    if (pts.length < k * 5){ geteilt.push(p); continue; }
    let z = pts.slice(0, k).map(q => q.slice());
    for (let it = 0; it < 25; it++){ // k-means
      const sum = z.map(() => [0, 0, 0]);
      for (const q of pts){
        let b = 0, bd = Infinity;
        for (let j = 0; j < k; j++){ const d = (q[0] - z[j][0]) ** 2 + (q[1] - z[j][1]) ** 2; if (d < bd){ bd = d; b = j; } }
        sum[b][0] += q[0]; sum[b][1] += q[1]; sum[b][2]++;
      }
      z = z.map((v, j) => sum[j][2] ? [sum[j][0] / sum[j][2], sum[j][1] / sum[j][2]] : v);
    }
    const vor = Delaunay.from(z).voronoi([box[0] * kos - 5, box[1] - 5, box[2] * kos + 5, box[3] + 5]);
    const teile = [];
    for (let j = 0; j < k; j++){
      const zelle = vor.cellPolygon(j); if (!zelle) continue;
      const ring = zelle.map(([x, y]) => [x / kos, y]);
      const s = sicher(pc.intersection, p.mp, [[ring]]);
      if (s.length && mpFlaeche(s) > 50) teile.push(s);
    }
    if (teile.length < 2){ geteilt.push(p); continue; }
    const cGes = mpSchwerpunkt(p.mp);
    const namen = teile.map(t => {
      const tc = mpSchwerpunkt(t), dx = (tc[0] - cGes[0]) * kos, dy = tc[1] - cGes[1];
      const r = Math.sqrt(fl / Math.PI) / 111;
      if (Math.hypot(dx, dy) < 0.3 * r) return 'Mitte';
      return RICHTUNG[Math.round(((Math.atan2(dy, dx) / Math.PI * 180) + 360) % 360 / 45) % 8];
    });
    const zaehler = {};
    teile.forEach((t, j) => {
      const n = namen[j]; zaehler[n] = (zaehler[n] || 0) + 1;
      const doppelt = namen.filter(x => x === n).length > 1;
      geteilt.push({ ...p, mp:t, name:`${p.name} ${n}${doppelt ? ' ' + zaehler[n] : ''}` });
    });
  }
  provinzen = geteilt;
  for (const p of provinzen){ // Regeln fuer Teilstuecke (z. B. Innere Mongolei)
    const c = mpSchwerpunkt(p.mp), r = G36.regel(p.adm0, p.orig, c[0], c[1]);
    if (r !== undefined) p.besitzer = r;
  }
  provinzen = provinzen.filter(p => p.besitzer);
  console.log('   Provinzen:', provinzen.length);

  // ---------- 6. Endgueltige Topologie + Vereinfachung ----------
  console.log('6. Topologie + Vereinfachung …');
  const P = path.join(TMP, 'p.geojson'), PT = path.join(TMP, 'p.topojson');
  fs.writeFileSync(P, JSON.stringify({ type:'FeatureCollection', features:provinzen.map((p, i) => ({
    type:'Feature', properties:{ i }, geometry:{ type:'MultiPolygon', coordinates:p.mp } })) }));
  await ms(`-i "${P}" snap -clean -simplify interval=2500 keep-shapes -o "${PT}" format=topojson quantization=200000 force`);
  const t = lesen(PT);
  const o = Object.values(t.objects)[0];
  // Bogen dekodieren (fuer Mittelpunkte/Flaechen)
  const [sx, sy] = t.transform.scale, [tx, ty] = t.transform.translate;
  const boegen = t.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
  const ringAus = idx => { const out = []; for (const i of idx){ const a = i < 0 ? boegen[~i].slice().reverse() : boegen[i]; out.push(...(out.length ? a.slice(1) : a)); } return out; };
  const geomMP = g => g.type === 'Polygon' ? [g.arcs.map(ringAus)] : g.type === 'MultiPolygon' ? g.arcs.map(p => p.map(ringAus)) : [];
  const nutzer = new Map();
  const liste = [];
  for (const g of o.geometries){
    if (!g.arcs || !g.arcs.length) continue;
    const p = provinzen[g.properties.i];
    const id = liste.length;
    for (const a of bogen(g)){ if (!nutzer.has(a)) nutzer.set(a, new Set()); nutzer.get(a).add(id); }
    liste.push({ g, p, mp:geomMP(g) });
  }
  const nb = liste.map(() => new Set());
  for (const s of nutzer.values()){ const l = [...s]; for (const a of l) for (const b of l) if (a !== b) nb[a].add(b); }
  const provOut = liste.map((e, id) => {
    const fl = mpFlaeche(e.mp);
    // Beschriftungspunkt: Schwerpunkt des groessten Teils, sonst bester Innenpunkt
    const groesst = e.mp.reduce((a, b) => polyFlaeche(a) >= polyFlaeche(b) ? a : b);
    let l = mpSchwerpunkt([groesst]);
    if (!imPoly(l[0], l[1], groesst)){
      const bx = mpBox([groesst]); let best = null, bd = -1;
      for (let i = 1; i < 20; i++) for (let j = 1; j < 20; j++){
        const x = bx[0] + (bx[2] - bx[0]) * i / 20, y = bx[1] + (bx[3] - bx[1]) * j / 20;
        if (!imPoly(x, y, groesst)) continue;
        const d = -Math.hypot(x - l[0], y - l[1]); if (best === null || d > bd){ bd = d; best = [x, y]; }
      }
      if (best) l = best;
    }
    return { g:e.g, id, n:e.p.name, l:[+l[0].toFixed(3), +l[1].toFixed(3)], a:Math.round(fl), nb:[...nb[id]].sort((a, b) => a - b), besitzer:e.p.besitzer, mp:e.mp };
  });
  // Gelaende: Stichproben in jeder Provinz gegen Natural-Earth-Regionen + Klimazonen
  const REG = { 'Range/mtn':'berg', 'Foothills':'huegel', 'Plateau':'huegel', 'Desert':'wueste', 'Tundra':'tundra', 'Wetlands':'sumpf' };
  const regionen = lesen(path.join(QUELLEN, 'regionen.geojson')).features
    .filter(f => REG[f.properties.FEATURECLA]).map(f => ({ art:REG[f.properties.FEATURECLA], mp:alsMP(f.geometry) }))
    .map(r => ({ ...r, box:mpBox(r.mp) }));
  function klima(x, y){
    const a = Math.abs(y);
    if (a > 68) return 'tundra';
    if ((y >= 57 && x > 10 && x < 180) || (y >= 50 && x < -52 && x > -170)) return 'wald';
    if (a < 9 && ((x > -80 && x < -45) || (x > 8 && x < 31) || (x > 95 && x < 155))) return 'dschungel';
    return 'ebene';
  }
  for (const p of provOut){
    const bx = mpBox(p.mp), zaehl = {};
    let n = 0;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++){
      const x = bx[0] + (bx[2] - bx[0]) * (i + 0.5) / 7, y = bx[1] + (bx[3] - bx[1]) * (j + 0.5) / 7;
      if (!imMP(x, y, p.mp)) continue;
      n++;
      let art = null;
      for (const r of regionen) if (x >= r.box[0] && x <= r.box[2] && y >= r.box[1] && y <= r.box[3] && imMP(x, y, r.mp)){ art = r.art; if (art === 'berg') break; }
      art = art || klima(x, y);
      zaehl[art] = (zaehl[art] || 0) + 1;
    }
    if (!n){ p.t = klima(p.l[0], p.l[1]); continue; }
    const anteil = k => (zaehl[k] || 0) / n;
    p.t = anteil('berg') >= 0.35 ? 'berg' : anteil('sumpf') >= 0.35 ? 'sumpf' : anteil('wueste') >= 0.5 ? 'wueste' :
      anteil('huegel') + anteil('berg') >= 0.4 ? 'huegel' : Object.keys(zaehl).sort((a, b) => zaehl[b] - zaehl[a])[0];
  }
  const ausgabe = {
    version:1,
    quelle:'Natural Earth Admin-1 (gemeinfrei), Grenzschnitte: historical-basemaps (GPL-3.0)',
    transform:t.transform,
    arcs:t.arcs,
    provinzen:provOut.map(p => ({ n:p.n, l:p.l, a:p.a, t:p.t, nb:p.nb, g:p.g.type === 'Polygon' ? [p.g.arcs] : p.g.arcs }))
  };
  fs.writeFileSync(path.join(DATEN, 'provinzen.json'), JSON.stringify(ausgabe));

  // ---------- 7. Startlage 1936 ----------
  const besitz = provOut.map(p => p.besitzer);
  const staaten = {};
  for (const [tag, s] of Object.entries(G36.STAATEN)){
    const eigene = provOut.filter(p => p.besitzer === tag);
    if (!eigene.length){ console.warn('   Staat ohne Provinzen:', tag); continue; }
    let hs = eigene.find(p => imMP(s.h[0], s.h[1], p.mp));
    if (!hs) hs = eigene.reduce((a, b) => distKm(a.l, s.h) <= distKm(b.l, s.h) ? a : b);
    staaten[tag] = { n:s.n, f:s.f, hauptstadt:hs.id, hn:G36.HAUPTSTADT[tag] || null };
    if (s.o) staaten[tag].oberherr = s.o;
  }
  const namen = {};
  provOut.forEach(p => {
    for (const [alt, neu] of Object.entries(G36.NAMEN)) if (p.n === alt || p.n.startsWith(alt + ' ')){ if (alt !== neu) namen[p.id] = neu + p.n.slice(alt.length); break; }
  });
  fs.writeFileSync(path.join(DATEN, 'epochen', '1936', 'welt.json'), JSON.stringify({
    epoche:'1936', datum:'1936-01-01', staaten, besitz, namen }, null, 0));
  const groesse = fs.statSync(path.join(DATEN, 'provinzen.json')).size;
  console.log(`Fertig: ${provOut.length} Provinzen, ${Object.keys(staaten).length} Staaten, provinzen.json ${(groesse / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

main().catch(e => { console.error(e); process.exit(1); });
