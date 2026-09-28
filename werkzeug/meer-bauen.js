'use strict';
// Epochen – teilt die Weltmeere in Seezonen (daten/meer.json).
//
//   node werkzeug/meer-bauen.js      (nach provinzen-bauen.js)
//
// Ablauf: 1°-Raster ueber das Meer -> k-means (Kuestennaehe zaehlt mehr) -> zusammenhaengende Teile
// -> Nachbarschaften aus dem Raster + Meerengen -> Voronoi-Zellen zum Zeichnen -> Namen aus Natural Earth.
const fs = require('fs');
const path = require('path');

const DATEN = path.join(__dirname, '..', 'daten');
const QUELLEN = path.join(__dirname, 'quellen');
const ZONEN = 240;

async function main(){
  const { Delaunay } = await import('d3-delaunay');
  const prov = JSON.parse(fs.readFileSync(path.join(DATEN, 'provinzen.json'), 'utf8'));
  const [sx, sy] = prov.transform.scale, [tx, ty] = prov.transform.translate;
  const boegen = prov.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
  const ring = idx => { const out = []; for (const i of idx){ const a = i < 0 ? boegen[~i].slice().reverse() : boegen[i]; out.push(...(out.length ? a.slice(1) : a)); } return out; };
  const P = prov.provinzen.map((p, id) => {
    const polys = p.g.map(poly => poly.map(ring));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of polys) for (const [x, y] of poly[0]){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { id, p, polys, box:[x0, y0, x1, y1] };
  });
  function imRing(x, y, r){
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++){
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  // Raumindex 5° fuer Land-Test
  const index = new Map();
  for (const q of P) for (let gx = Math.floor(q.box[0] / 5); gx <= Math.floor(q.box[2] / 5); gx++) for (let gy = Math.floor(q.box[1] / 5); gy <= Math.floor(q.box[3] / 5); gy++){
    const k = gx + ',' + gy; (index.get(k) || index.set(k, []).get(k)).push(q);
  }
  const istLand = (x, y) => (index.get(Math.floor(x / 5) + ',' + Math.floor(y / 5)) || []).some(q =>
    x >= q.box[0] && x <= q.box[2] && y >= q.box[1] && y <= q.box[3] && q.polys.some(poly => imRing(x, y, poly[0]) && !poly.slice(1).some(h => imRing(x, y, h))));

  // ---------- Raster ----------
  const R = 0.5; // Rasterweite in Grad
  const W = 360 / R, Y0 = -70, H = Math.round(155 / R);
  const lonVon = i => -180 + R / 2 + i * R, latVon = j => Y0 + R / 2 + j * R;
  const meer = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) meer[j * W + i] = istLand(lonVon(i), latVon(j)) ? 0 : 1;
  const zellen = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (meer[j * W + i]) zellen.push(j * W + i);
  // Kuestennaehe: Land in ~3 Grad Umkreis
  const kueste = new Uint8Array(W * H), UM = Math.round(3 / R);
  for (const c of zellen){
    const i = c % W, j = (c / W) | 0;
    outer: for (let dj = -UM; dj <= UM; dj++) for (let di = -UM; di <= UM; di++){
      const jj = j + dj; if (jj < 0 || jj >= H) continue;
      if (!meer[jj * W + ((i + di + W) % W)]){ kueste[c] = 1; break outer; }
    }
  }
  console.log('Meereszellen:', zellen.length);

  // ---------- Meeresgebiete (Natural Earth) je Zelle ----------
  const OZEAN = { 'north atlantic ocean':'Nordatlantik', 'south atlantic ocean':'Südatlantik', 'north pacific ocean':'Nordpazifik',
    'south pacific ocean':'Südpazifik', 'indian ocean':'Indischer Ozean', 'arctic ocean':'Nordpolarmeer', 'southern ocean':'Südpolarmeer' };
  const meere = JSON.parse(fs.readFileSync(path.join(QUELLEN, 'meere.geojson'), 'utf8')).features.map(f => {
    const g = f.geometry, mp = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of mp) for (const [x, y] of p[0]){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const pr = f.properties, en = (pr.name_en || pr.name || '').toLowerCase();
    return { mp, box:[x0, y0, x1, y1], rang:pr.scalerank, name:OZEAN[en] || pr.name_de || pr.name, ozean:pr.featurecla === 'ocean' };
  }).filter(m => m.name);
  const ozeanNach = (lon, lat) => lat > 60 ? 'Nordpolarmeer' : lat < -55 ? 'Südpolarmeer' :
    (lon > 20 && lon < 115 && lat < 25) ? 'Indischer Ozean' : (lon > -70 && lon < 20) ? (lat >= 0 ? 'Nordatlantik' : 'Südatlantik') : (lat >= 0 ? 'Nordpazifik' : 'Südpazifik');
  const gebiet = new Array(W * H).fill(null);
  for (const c of zellen){
    const x = lonVon(c % W), y = latVon((c / W) | 0);
    const treffer = meere.filter(m => !m.ozean && x >= m.box[0] && x <= m.box[2] && y >= m.box[1] && y <= m.box[3] && m.mp.some(p => imRing(x, y, p[0])));
    treffer.sort((a, b) => b.rang - a.rang);
    let n = treffer.length ? treffer[0].name : ozeanNach(x, y);
    if (n === 'Atlantischer Ozean' || n === 'Pazifischer Ozean') n = ozeanNach(x, y);
    gebiet[c] = n;
  }

  // ---------- k-means je Meeresgebiet (Zonen ueberschreiten keine Meeresgrenzen) ----------
  let z = 4711; const rnd = () => (z = (z * 16807) % 2147483647) / 2147483647;
  const gew = c => (kueste[c] ? 4 : 1) * Math.cos(latVon((c / W) | 0) * Math.PI / 180);
  const dist2 = (lon1, lat1, lon2, lat2) => {
    let dx = Math.abs(lon1 - lon2); if (dx > 180) dx = 360 - dx;
    dx *= Math.cos((lat1 + lat2) / 2 * Math.PI / 180); const dy = lat1 - lat2; return dx * dx + dy * dy;
  };
  const zu = new Int16Array(W * H).fill(-1);
  const proGebiet = new Map();
  for (const c of zellen) (proGebiet.get(gebiet[c]) || proGebiet.set(gebiet[c], []).get(gebiet[c])).push(c);
  const gesamt = zellen.reduce((s, c) => s + gew(c), 0);
  const zoneName = [];
  for (const [name, zs] of [...proGebiet].sort((a, b) => a[0] < b[0] ? -1 : 1)){
    const wsum = zs.reduce((s, c) => s + gew(c), 0);
    const k = Math.max(1, Math.round(ZONEN * wsum / gesamt));
    let zentren = [];
    for (let q = 0; q < k; q++){
      let r = rnd() * wsum, c = zs[0];
      for (const x of zs){ r -= gew(x); if (r <= 0){ c = x; break; } }
      zentren.push([lonVon(c % W), latVon((c / W) | 0)]);
    }
    const basis = zoneName.length;
    for (let it = 0; it < 25; it++){
      const sum = zentren.map(() => [0, 0, 0, 0]);
      for (const c of zs){
        const lon = lonVon(c % W), lat = latVon((c / W) | 0);
        let b = 0, bd = Infinity;
        for (let q = 0; q < zentren.length; q++){ const d = dist2(lon, lat, zentren[q][0], zentren[q][1]); if (d < bd){ bd = d; b = q; } }
        zu[c] = basis + b; const g = gew(c);
        sum[b][0] += Math.cos(lon * Math.PI / 180) * g; sum[b][1] += Math.sin(lon * Math.PI / 180) * g; sum[b][2] += lat * g; sum[b][3] += g;
      }
      zentren = zentren.map((v, q) => sum[q][3] ? [Math.atan2(sum[q][1], sum[q][0]) * 180 / Math.PI, sum[q][2] / sum[q][3]] : v);
    }
    for (let q = 0; q < k; q++) zoneName.push(name);
  }
  // ---------- zusammenhaengende Teile: nur der groesste bleibt, Rest zum Nachbarn ----------
  const nachbarZellen = c => {
    const i = c % W, j = (c / W) | 0, out = [];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]){
      const jj = j + dj; if (jj < 0 || jj >= H) continue;
      const n = jj * W + ((i + di + W) % W); if (meer[n]) out.push(n);
    }
    return out;
  };
  for (let runde = 0; runde < 5; runde++){
    const gesehen = new Uint8Array(W * H); let geaendert = 0;
    const teile = new Map();
    for (const c of zellen){
      if (gesehen[c]) continue;
      const k = zu[c], st = [c], teil = []; gesehen[c] = 1;
      while (st.length){ const x = st.pop(); teil.push(x); for (const n of nachbarZellen(x)) if (!gesehen[n] && zu[n] === k){ gesehen[n] = 1; st.push(n); } }
      (teile.get(k) || teile.set(k, []).get(k)).push(teil);
    }
    for (const [k, liste] of teile){
      liste.sort((a, b) => b.length - a.length);
      for (const teil of liste.slice(1)){
        const zaehl = {};
        for (const x of teil) for (const n of nachbarZellen(x)) if (zu[n] !== k && zoneName[zu[n]] === zoneName[k]) zaehl[zu[n]] = (zaehl[zu[n]] || 0) + 1;
        if (!Object.keys(zaehl).length) for (const x of teil) for (const n of nachbarZellen(x)) if (zu[n] !== k) zaehl[zu[n]] = (zaehl[zu[n]] || 0) + 1;
        const neu = Object.keys(zaehl).sort((a, b) => zaehl[b] - zaehl[a])[0];
        if (neu !== undefined){ for (const x of teil) zu[x] = +neu; geaendert++; }
      }
    }
    if (!geaendert) break;
  }
  // Winzige Zonen (Buchten) an den Nachbarn mit der laengsten Grenze haengen
  for (let runde = 0; runde < 3; runde++){
    const groesse = new Map(); for (const c of zellen) groesse.set(zu[c], (groesse.get(zu[c]) || 0) + 1);
    for (const [k, g] of [...groesse].sort((x, y) => x[1] - y[1])){
      if (g >= 7 / (R * R)) break;
      const zaehl = {};
      for (const c of zellen) if (zu[c] === k) for (const n of nachbarZellen(c)) if (zu[n] !== k) zaehl[zu[n]] = (zaehl[zu[n]] || 0) + 1;
      const neu = Object.keys(zaehl).sort((x, y) => zaehl[y] - zaehl[x])[0];
      if (neu !== undefined) for (const c of zellen) if (zu[c] === k) zu[c] = +neu;
    }
  }
  // Zonen neu nummerieren (leere entfernen), Mittelpunkt = Zelle nahe am Schwerpunkt
  const benutzt = [...new Set(zellen.map(c => zu[c]))].sort((a, b) => a - b);
  const neuId = new Map(benutzt.map((k, i) => [k, i]));
  for (const c of zellen) zu[c] = neuId.get(zu[c]);
  const nZ = benutzt.length;
  const zZellen = Array.from({ length:nZ }, () => []);
  for (const c of zellen) zZellen[zu[c]].push(c);
  const mitte = zZellen.map(l => {
    let cx = 0, cy = 0, sxs = 0; for (const c of l){ const lon = lonVon(c % W) * Math.PI / 180; cx += Math.cos(lon); cy += Math.sin(lon); sxs += latVon((c / W) | 0); }
    const lon = Math.atan2(cy, cx) * 180 / Math.PI, lat = sxs / l.length;
    let best = l[0], bd = Infinity; for (const c of l){ const d = dist2(lonVon(c % W), latVon((c / W) | 0), lon, lat); if (d < bd){ bd = d; best = c; } }
    return [lonVon(best % W), latVon((best / W) | 0)];
  });
  // ---------- Nachbarschaften ----------
  const nb = Array.from({ length:nZ }, () => new Set());
  for (const c of zellen) for (const n of nachbarZellen(c)) if (zu[n] !== zu[c]){ nb[zu[c]].add(zu[n]); nb[zu[n]].add(zu[c]); }
  const zoneAm = (lon, lat) => {
    let best = -1, bd = Infinity;
    for (const c of zellen){ const d = dist2(lon, lat, lonVon(c % W), latVon((c / W) | 0)); if (d < bd){ bd = d; best = c; } }
    return zu[best];
  };
  const MEERENGEN = [
    ['Gibraltar', [-7, 36], [-3.5, 36.2]], ['Dardanellen und Bosporus', [25.5, 39.5], [30, 42.8]], ['Öresund', [11.5, 57], [13.5, 55]],
    ['Sueskanal', [32.4, 31.8], [33.5, 27.5]], ['Panamakanal', [-79.5, 10.5], [-79.5, 7.5]], ['Straße von Hormus', [52, 27], [58, 24.5]],
    ['Straße von Messina', [15.2, 39], [16, 37.5]], ['Bab al-Mandab', [42.3, 14.5], [44, 12]], ['Kertsch', [35.8, 44.8], [36.8, 45.8]]
  ];
  for (const [, a, b] of MEERENGEN){ const za = zoneAm(...a), zb = zoneAm(...b); if (za !== zb){ nb[za].add(zb); nb[zb].add(za); } }

  // ---------- Kuestenprovinzen -> Seezonen ----------
  const nutzer = new Map();
  prov.provinzen.forEach((p, id) => { const lauf = x => Array.isArray(x) ? x.forEach(lauf) : (nutzer.get(x < 0 ? ~x : x) || nutzer.set(x < 0 ? ~x : x, new Set()).get(x < 0 ? ~x : x)).add(id); lauf(p.g); });
  const provSee = prov.provinzen.map(() => new Set());
  const zelleNahe = (lon, lat) => {
    const i0 = Math.floor((lon + 180) / R), j0 = Math.floor((lat - Y0) / R), U = Math.round(2 / R);
    let best = -1, bd = Infinity;
    for (let dj = -U; dj <= U; dj++) for (let di = -U; di <= U; di++){
      const j = j0 + dj; if (j < 0 || j >= H) continue;
      const c = j * W + ((i0 + di + W) % W); if (!meer[c]) continue;
      const d = dist2(lon, lat, lonVon(c % W), latVon(j)); if (d < bd){ bd = d; best = c; }
    }
    return best;
  };
  for (const [bi, s] of nutzer){
    if (s.size !== 1) continue;
    const id = [...s][0], b = boegen[bi];
    for (let k = 0; k < b.length; k += Math.max(1, Math.floor(b.length / 6))){
      const c = zelleNahe(b[k][0], b[k][1]); if (c >= 0) provSee[id].add(zu[c]);
    }
  }
  const zoneKueste = Array.from({ length:nZ }, () => []);
  provSee.forEach((s, id) => s.forEach(zz => zoneKueste[zz].push(id)));

  // ---------- Namen: aus dem Meeresgebiet ----------
  const namen = benutzt.map(k => zoneName[k]);
  // doppelte Namen mit Himmelsrichtung / Nummer unterscheiden
  const RICHT = ['Ost', 'Nordost', 'Nord', 'Nordwest', 'West', 'Südwest', 'Süd', 'Südost'];
  const gruppen = {};
  namen.forEach((n, k) => (gruppen[n] || (gruppen[n] = [])).push(k));
  for (const [n, ks] of Object.entries(gruppen)){
    if (ks.length < 2) continue;
    let cx = 0, cy = 0; ks.forEach(k => { cx += mitte[k][0]; cy += mitte[k][1]; }); cx /= ks.length; cy /= ks.length;
    const teile = ks.map(k => { const dx = mitte[k][0] - cx, dy = mitte[k][1] - cy; return Math.hypot(dx, dy) < 3 ? 'Mitte' : RICHT[Math.round(((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360 / 45) % 8]; });
    const z = {};
    ks.forEach((k, i) => { const t = teile[i]; z[t] = (z[t] || 0) + 1; const doppelt = teile.filter(x => x === t).length > 1; namen[k] = `${n} ${t}${doppelt ? ' ' + z[t] : ''}`; });
  }

  // ---------- Voronoi-Zellen zum Zeichnen ----------
  const pts = [];
  mitte.forEach(([x, y]) => { pts.push([x, y], [x - 360, y], [x + 360, y]); });
  const vor = Delaunay.from(pts).voronoi([-181, -73, 181, 86]);
  const polys = mitte.map((_, k) => {
    const c = vor.cellPolygon(k * 3); if (!c) return [];
    return c.map(([x, y]) => [+Math.max(-180, Math.min(180, x)).toFixed(2), +y.toFixed(2)]);
  });

  const aus = {
    version:1,
    zonen:mitte.map((l, k) => ({ n:namen[k], l, nb:[...nb[k]].sort((a, b) => a - b), kp:zoneKueste[k].sort((a, b) => a - b), poly:polys[k] })),
    provSee:provSee.map(s => [...s].sort((a, b) => a - b)),
    meerengen:MEERENGEN.map(m => m[0])
  };
  fs.writeFileSync(path.join(DATEN, 'meer.json'), JSON.stringify(aus));
  const g = fs.statSync(path.join(DATEN, 'meer.json')).size;
  console.log(`Fertig: ${nZ} Seezonen, ${provSee.filter(s => s.size).length} Küstenprovinzen mit Zugang, meer.json ${(g / 1024).toFixed(0)} KB`);
  const probe = (lon, lat) => namen[zoneAm(lon, lat)];
  console.log('Proben:', ['Nordsee', [3, 56]], ['Ostsee', [19, 57]], ['Mittelmeer', [18, 36]], ['Schwarzes Meer', [34, 43]], ['Ärmelkanal', [-1, 50]], ['Karibik', [-75, 15]]);
  for (const [lon, lat] of [[3, 56], [19, 57], [18, 36], [34, 43], [-1, 50], [-75, 15], [135, 35], [-40, 30]]) console.log(' ', lon, lat, probe(lon, lat));
}
main().catch(e => { console.error(e); process.exit(1); });
