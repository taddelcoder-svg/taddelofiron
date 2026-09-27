'use strict';
// Epochen – Weltkarte: dekodiert die Provinz-Topologie, zeichnet auf Canvas
// (Kartenstile pro Epoche, Level of Detail) und verarbeitet Maus/Touch/Tastatur.
(function(){
  const RAD = Math.PI / 180;
  // Miller-Projektion, Ergebnis in "Grad"-Einheiten (x = Laenge, y nach unten)
  const projY = lat => -1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * RAD)) / RAD;
  const WELT_B = 360;
  const Y_MIN = projY(84), Y_MAX = projY(-60);

  // ---------- Kartenstile ----------
  function mischen(a, b, t){
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const x = p(a), y = p(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const STILE = {
    generalstab:{
      name:'Generalstab', meer:'#c9d5d2', gitter:'rgba(70,95,100,.18)', land:f => mischen(f, '#e6dcc0', .42),
      kueste:'#3e4c4f', kuesteB:1.1, grenze:'#26221c', grenzeB:1.7, prov:'rgba(40,34,24,.28)', provB:.6,
      schrift:'"Courier New", Courier, monospace', text:'#1f1b14', textRand:'rgba(236,228,206,.75)', gross:true,
      hover:'rgba(255,255,255,.28)', wahl:'#b3261e'
    },
    flach:{
      name:'Lesbar', meer:'#2c5a84', gitter:null, land:f => f,
      kueste:'#10202e', kuesteB:1, grenze:'#0b0b0b', grenzeB:1.8, prov:'rgba(0,0,0,.22)', provB:.6,
      schrift:'system-ui, "Segoe UI", Arial, sans-serif', text:'#ffffff', textRand:'rgba(0,0,0,.7)', gross:true,
      hover:'rgba(255,255,255,.3)', wahl:'#ffd23f'
    }
  };

  class Karte {
    constructor(canvas, provDaten, welt){
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.welt = welt;
      this.stil = STILE.generalstab;
      this.dekodieren(provDaten);
      for (const id in (welt.namen || {})) this.prov[id].n = welt.namen[id]; // Namen der Epoche
      this.besitz = welt.besitz.slice();       // wer die Provinz kontrolliert (Farbe, Grenzen)
      this.eigentuemer = welt.besitz.slice();  // Kernland; Abweichung = besetzt (Schraffur)
      this.kamera = { x:10, y:projY(50), z:6 }; // z = Pixel pro Grad
      this.hover = -1; this.auswahl = -1; this.auswahlStaat = null;
      this.beiKlick = null; this.beiHover = null; this.beiRechtsklick = null; this.beiZeichnen = null;
      this.schraffur = this.bauSchraffur();
      this.schmutzig = true;
      this.baueGrenzen();
      this.eingabe();
      this.groesse();
      addEventListener('resize', () => this.groesse());
      const schleife = () => { if (this.schmutzig){ this.schmutzig = false; this.zeichnen(); } requestAnimationFrame(schleife); };
      requestAnimationFrame(schleife);
    }

    // ---------- Daten ----------
    dekodieren(d){
      const [sx, sy] = d.transform.scale, [tx, ty] = d.transform.translate;
      // Boegen in Weltkoordinaten; Laengen-Spruenge ueber die Datumsgrenze vermeiden
      this.boegen = d.arcs.map(a => {
        let x = 0, y = 0; const out = new Float32Array(a.length * 2);
        for (let i = 0; i < a.length; i++){
          x += a[i][0]; y += a[i][1];
          out[i * 2] = x * sx + tx; out[i * 2 + 1] = projY(Math.max(-85, Math.min(85, y * sy + ty)));
        }
        return out;
      });
      this.bogenNutzer = this.boegen.map(() => []);
      this.prov = d.provinzen.map((p, id) => {
        const pfad = new Path2D();
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const poly of p.g) for (const ring of poly){
          let erst = true;
          for (const ai of ring){
            const i = ai < 0 ? ~ai : ai, b = this.boegen[i];
            if (!this.bogenNutzer[i].includes(id)) this.bogenNutzer[i].push(id);
            const n = b.length / 2;
            for (let k = 0; k < n; k++){
              const j = ai < 0 ? n - 1 - k : k, x = b[j * 2], y = b[j * 2 + 1];
              if (erst){ pfad.moveTo(x, y); erst = false; } else pfad.lineTo(x, y);
              if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
          }
          pfad.closePath();
        }
        return { id, n:p.n, a:p.a, nb:p.nb, l:[p.l[0], projY(p.l[1])], box:[x0, y0, x1, y1], pfad };
      });
    }
    staat(tag){ return this.welt.staaten[tag]; }
    bauSchraffur(){
      const k = document.createElement('canvas'); k.width = k.height = 8;
      const c = k.getContext('2d'); c.strokeStyle = 'rgba(20,16,10,.45)'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-2, 10); c.lineTo(10, -2); c.moveTo(6, 10); c.lineTo(10, 6); c.moveTo(-2, 2); c.lineTo(2, -2); c.stroke();
      return this.ctx.createPattern(k, 'repeat');
    }

    // Grenzen je nach Besitz neu aufbauen (Kueste, Staatsgrenze, Provinzgrenze) + Beschriftungen
    baueGrenzen(){
      const kueste = new Path2D(), grenze = new Path2D(), prov = new Path2D();
      this.boegen.forEach((b, i) => {
        const nutzer = this.bogenNutzer[i];
        const ziel = nutzer.length < 2 ? kueste : this.besitz[nutzer[0]] !== this.besitz[nutzer[1]] ? grenze : prov;
        ziel.moveTo(b[0], b[1]);
        for (let k = 2; k < b.length; k += 2) ziel.lineTo(b[k], b[k + 1]);
      });
      this.pfade = { kueste, grenze, prov };
      this.baueBeschriftung();
      this.schmutzig = true;
    }
    baueBeschriftung(){
      // Zusammenhaengende Gebiete je Staat -> ein Namensschild pro Gebiet
      const gesehen = new Uint8Array(this.prov.length), schilder = [];
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const p of this.prov){
        if (gesehen[p.id]) continue;
        const tag = this.besitz[p.id], teil = [], stapel = [p.id]; gesehen[p.id] = 1;
        while (stapel.length){
          const i = stapel.pop(); teil.push(i);
          for (const n of this.prov[i].nb) if (!gesehen[n] && this.besitz[n] === tag){ gesehen[n] = 1; stapel.push(n); }
        }
        let fl = 0, cx = 0, cy = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const i of teil){
          const q = this.prov[i]; fl += q.a; cx += q.l[0] * q.a; cy += q.l[1] * q.a;
          x0 = Math.min(x0, q.box[0]); x1 = Math.max(x1, q.box[2]); y0 = Math.min(y0, q.box[1]); y1 = Math.max(y1, q.box[3]);
        }
        cx /= fl; cy /= fl;
        // Mittelpunkt muss in einer eigenen Provinz liegen
        let best = teil[0], bd = Infinity;
        for (const i of teil){ const q = this.prov[i]; const d = (q.l[0] - cx) ** 2 + (q.l[1] - cy) ** 2; if (d < bd){ bd = d; best = i; } }
        const drin = teil.some(i => this.ctx.isPointInPath(this.prov[i].pfad, cx, cy));
        const pos = drin ? [cx, cy] : this.prov[best].l;
        const name = this.staat(tag).n;
        const breite = Math.min(x1 - x0, Math.sqrt(fl) / 90 * 1.6);
        const hoehe = y1 - y0;
        const fs = Math.min(breite * 1.05 / (name.length * 0.62), hoehe * 0.45, Math.sqrt(fl) / 230);
        schilder.push({ tag, name, x:pos[0], y:pos[1], fs, fl });
      }
      schilder.sort((a, b) => b.fl - a.fl);
      this.schilder = schilder;
    }
    setzeBesitz(id, tag){ this.besitz[id] = tag; this.baueGrenzen(); }

    // ---------- Kamera ----------
    groesse(){
      const dpr = Math.min(2, devicePixelRatio || 1);
      this.dpr = dpr;
      this.cv.width = Math.round(this.cv.clientWidth * dpr);
      this.cv.height = Math.round(this.cv.clientHeight * dpr);
      this.begrenzen(); this.schmutzig = true;
    }
    begrenzen(){
      const k = this.kamera, h = this.cv.height / this.dpr, b = this.cv.width / this.dpr;
      k.z = Math.max(Math.max(b / WELT_B, h / (Y_MAX - Y_MIN)) * 0.9, Math.min(260, k.z));
      const halb = h / 2 / k.z;
      k.y = (Y_MAX - Y_MIN) < 2 * halb ? (Y_MIN + Y_MAX) / 2 : Math.max(Y_MIN + halb, Math.min(Y_MAX - halb, k.y));
      k.x = ((k.x + 180) % 360 + 360) % 360 - 180;
    }
    zuWelt(px, py){ // CSS-Pixel -> Welt
      const k = this.kamera;
      return [k.x + (px - this.cv.clientWidth / 2) / k.z, k.y + (py - this.cv.clientHeight / 2) / k.z];
    }
    zoomAn(px, py, faktor){
      const [wx, wy] = this.zuWelt(px, py);
      this.kamera.z *= faktor; this.begrenzen();
      const [nx, ny] = this.zuWelt(px, py);
      this.kamera.x += wx - nx; this.kamera.y += wy - ny;
      this.begrenzen(); this.schmutzig = true;
    }
    fliegeZu(id, z){
      const p = this.prov[id]; this.kamera.x = p.l[0]; this.kamera.y = p.l[1];
      if (z) this.kamera.z = z;
      this.begrenzen(); this.schmutzig = true;
    }
    // Welt-Versaetze (-360/0/+360), die gerade sichtbar sind
    versaetze(){
      const b = this.cv.clientWidth / 2 / this.kamera.z, out = [];
      for (const v of [-WELT_B, 0, WELT_B]) if (this.kamera.x - b < 180 + v && this.kamera.x + b > -180 + v) out.push(v);
      return out;
    }

    // ---------- Zeichnen ----------
    zeichnen(){
      const c = this.ctx, s = this.stil, k = this.kamera, dpr = this.dpr;
      const B = this.cv.clientWidth, H = this.cv.clientHeight;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = s.meer; c.fillRect(0, 0, this.cv.width, this.cv.height);
      const px = 1 / k.z; // eine Bildschirm-Linie in Weltbreite
      const [wx0, wy0] = this.zuWelt(0, 0), [wx1, wy1] = this.zuWelt(B, H);
      for (const v of this.versaetze()){
        c.setTransform(k.z * dpr, 0, 0, k.z * dpr, (B / 2 - (k.x - v) * k.z) * dpr, (H / 2 - k.y * k.z) * dpr);
        const sx0 = wx0 - v, sx1 = wx1 - v;
        // Gitternetz (Laengen-/Breitengrade)
        if (s.gitter){
          c.strokeStyle = s.gitter; c.lineWidth = px; c.beginPath();
          const schritt = k.z > 40 ? 5 : 10;
          for (let lon = -180; lon <= 180; lon += schritt){ c.moveTo(lon, Y_MIN); c.lineTo(lon, Y_MAX); }
          for (let lat = -60; lat <= 80; lat += schritt){ const y = projY(lat); c.moveTo(-180, y); c.lineTo(180, y); }
          c.stroke();
        }
        // Provinzflaechen, nach Farbe gebuendelt
        const farbe = {};
        for (const p of this.prov){
          if (p.box[2] < sx0 || p.box[0] > sx1 || p.box[3] < wy0 || p.box[1] > wy1) continue;
          const t = this.besitz[p.id];
          (farbe[t] || (farbe[t] = [])).push(p);
        }
        for (const t in farbe){
          c.fillStyle = s.land(this.staat(t).f);
          for (const p of farbe[t]) c.fill(p.pfad);
        }
        // Auswahl des ganzen Staates
        if (this.auswahlStaat){
          c.fillStyle = 'rgba(255,255,255,.18)';
          for (const t in farbe) if (t === this.auswahlStaat) for (const p of farbe[t]) c.fill(p.pfad);
        }
        // Besetzte Provinzen schraffieren (Muster in Bildschirmgroesse)
        if (this.schraffur){
          this.schraffur.setTransform(new DOMMatrix().scale(1 / (k.z * dpr)).translate(0, 0));
          c.fillStyle = this.schraffur;
          for (const t in farbe) for (const p of farbe[t]) if (this.eigentuemer[p.id] !== t) c.fill(p.pfad);
        }
        if (this.hover >= 0){ c.fillStyle = s.hover; c.fill(this.prov[this.hover].pfad); }
        c.lineJoin = 'round'; c.lineCap = 'round';
        if (k.z > 9){ c.strokeStyle = s.prov; c.lineWidth = s.provB * px * Math.min(1.6, k.z / 14); c.stroke(this.pfade.prov); }
        c.strokeStyle = s.kueste; c.lineWidth = s.kuesteB * px; c.stroke(this.pfade.kueste);
        c.strokeStyle = s.grenze; c.lineWidth = s.grenzeB * px * Math.min(1.5, Math.max(.7, k.z / 10)); c.stroke(this.pfade.grenze);
        if (this.auswahl >= 0){ c.strokeStyle = s.wahl; c.lineWidth = 2.5 * px; c.stroke(this.prov[this.auswahl].pfad); }
      }
      this.zeichneText(B, H);
      if (this.beiZeichnen){
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.beiZeichnen(c, (wx, wy, v) => [B / 2 + (wx + v - k.x) * k.z, H / 2 + (wy - k.y) * k.z], this.versaetze());
      }
    }
    zeichneText(B, H){
      const c = this.ctx, s = this.stil, k = this.kamera, dpr = this.dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      const belegt = [];
      const frei = (x0, y0, x1, y1) => { for (const r of belegt) if (x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]) return false; belegt.push([x0, y0, x1, y1]); return true; };
      const ort = (wx, wy, v) => [B / 2 + (wx + v - k.x) * k.z, H / 2 + (wy - k.y) * k.z];
      // Hauptstaedte
      for (const v of this.versaetze()) for (const tag in this.welt.staaten){
        const hs = this.welt.staaten[tag].hauptstadt; if (this.besitz[hs] !== tag) continue;
        const [x, y] = ort(this.prov[hs].l[0], this.prov[hs].l[1], v);
        if (x < -10 || y < -10 || x > B + 10 || y > H + 10 || k.z < 3.5) continue;
        c.fillStyle = s.text; c.strokeStyle = s.textRand; c.lineWidth = 2;
        c.beginPath(); c.arc(x, y, k.z > 12 ? 3.5 : 2.5, 0, Math.PI * 2); c.stroke(); c.fill();
      }
      // Staatsnamen
      const provNamen = k.z > 22;
      for (const v of this.versaetze()) for (const sc of this.schilder){
        let fs = sc.fs * k.z;
        if (fs < 9) continue;
        fs = Math.min(fs, provNamen ? 24 : 46);
        const [x, y] = ort(sc.x, sc.y, v);
        if (x < -300 || x > B + 300 || y < -60 || y > H + 60) continue;
        const text = s.gross ? sc.name.toUpperCase() : sc.name;
        c.font = `bold ${fs.toFixed(1)}px ${s.schrift}`;
        const sp = Math.max(0, fs * 0.12);
        if ('letterSpacing' in c) c.letterSpacing = sp.toFixed(1) + 'px';
        const w = c.measureText(text).width;
        if (!frei(x - w / 2, y - fs / 2, x + w / 2, y + fs / 2)) continue;
        c.globalAlpha = provNamen ? .55 : .92;
        c.strokeStyle = s.textRand; c.lineWidth = Math.max(2, fs / 7); c.strokeText(text, x, y);
        c.fillStyle = s.text; c.fillText(text, x, y);
        c.globalAlpha = 1;
      }
      if ('letterSpacing' in c) c.letterSpacing = '0px';
      // Provinznamen bei starkem Zoom
      if (provNamen){
        c.font = `${Math.min(14, 8 + k.z / 12).toFixed(1)}px ${s.schrift}`;
        for (const v of this.versaetze()) for (const p of this.prov){
          const breite = (p.box[2] - p.box[0]) * k.z;
          if (breite < 60) continue;
          const [x, y] = ort(p.l[0], p.l[1], v);
          if (x < 0 || x > B || y < 0 || y > H) continue;
          const w = c.measureText(p.n).width;
          if (w > breite * 1.1 || !frei(x - w / 2, y - 7, x + w / 2, y + 7)) continue;
          c.strokeStyle = s.textRand; c.lineWidth = 2.5; c.strokeText(p.n, x, y);
          c.fillStyle = s.text; c.fillText(p.n, x, y);
        }
      }
    }

    // ---------- Treffer ----------
    provinzAn(px, py){
      const [wx0, wy] = this.zuWelt(px, py);
      const wx = ((wx0 + 180) % 360 + 360) % 360 - 180;
      const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0);
      for (const p of this.prov){
        if (wx < p.box[0] || wx > p.box[2] || wy < p.box[1] || wy > p.box[3]) continue;
        if (c.isPointInPath(p.pfad, wx, wy)) return p.id;
      }
      return -1;
    }

    // ---------- Eingabe: Maus, Touch (Pinch), Tastatur ----------
    eingabe(){
      const cv = this.cv, zeiger = new Map();
      let zug = null, pinch = null, bewegt = 0;
      const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener('pointerdown', e => {
        cv.setPointerCapture(e.pointerId);
        zeiger.set(e.pointerId, pos(e)); bewegt = 0;
        if (zeiger.size === 1) zug = pos(e);
        if (zeiger.size === 2){ const [a, b] = [...zeiger.values()]; pinch = { d:Math.hypot(a[0] - b[0], a[1] - b[1]) }; zug = null; }
      });
      cv.addEventListener('pointermove', e => {
        const p = pos(e);
        if (zeiger.has(e.pointerId)){
          const alt = zeiger.get(e.pointerId); zeiger.set(e.pointerId, p);
          if (pinch && zeiger.size === 2){
            const [a, b] = [...zeiger.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
            this.zoomAn((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch.d); pinch.d = d; bewegt += 10;
            // Mitte mitziehen
            const f = 0.5 / this.kamera.z;
            this.kamera.x -= (p[0] - alt[0]) * f; this.kamera.y -= (p[1] - alt[1]) * f;
          } else if (zug){
            bewegt += Math.abs(p[0] - alt[0]) + Math.abs(p[1] - alt[1]);
            this.kamera.x -= (p[0] - alt[0]) / this.kamera.z; this.kamera.y -= (p[1] - alt[1]) / this.kamera.z;
          }
          this.begrenzen(); this.schmutzig = true;
        } else if (e.pointerType === 'mouse'){
          const id = this.provinzAn(p[0], p[1]);
          if (id !== this.hover){ this.hover = id; this.schmutzig = true; }
          if (this.beiHover) this.beiHover(id, p);
        }
      });
      const ende = e => {
        const war = zeiger.has(e.pointerId);
        zeiger.delete(e.pointerId);
        if (zeiger.size < 2) pinch = null;
        if (war && zeiger.size === 0){
          if (bewegt < 8 && e.type === 'pointerup' && e.button !== 2){
            const p = pos(e), id = this.provinzAn(p[0], p[1]);
            this.auswahl = id; this.schmutzig = true;
            if (this.beiKlick) this.beiKlick(id, e, p);
          }
          zug = null;
        } else if (zeiger.size === 1){ zug = [...zeiger.values()][0]; }
      };
      cv.addEventListener('contextmenu', e => {
        e.preventDefault();
        const p = pos(e);
        if (this.beiRechtsklick) this.beiRechtsklick(this.provinzAn(p[0], p[1]), p);
      });
      cv.addEventListener('pointerup', ende); cv.addEventListener('pointercancel', ende);
      cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && this.hover >= 0){ this.hover = -1; this.schmutzig = true; if (this.beiHover) this.beiHover(-1); } });
      cv.addEventListener('wheel', e => {
        e.preventDefault();
        const p = pos(e), d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        this.zoomAn(p[0], p[1], Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0015)));
      }, { passive:false });
      const tasten = new Set();
      addEventListener('keydown', e => {
        if (e.target.closest && e.target.closest('input,textarea')) return;
        tasten.add(e.key.toLowerCase());
        if (e.key === '+' || e.key === '=') this.zoomAn(cv.clientWidth / 2, cv.clientHeight / 2, 1.25);
        if (e.key === '-') this.zoomAn(cv.clientWidth / 2, cv.clientHeight / 2, 0.8);
      });
      addEventListener('keyup', e => tasten.delete(e.key.toLowerCase()));
      addEventListener('blur', () => tasten.clear());
      let letzte = performance.now();
      const scrollen = t => {
        const dt = Math.min(0.05, (t - letzte) / 1000); letzte = t;
        const v = 700 * dt / this.kamera.z;
        let dx = 0, dy = 0;
        if (tasten.has('a') || tasten.has('arrowleft')) dx -= v;
        if (tasten.has('d') || tasten.has('arrowright')) dx += v;
        if (tasten.has('w') || tasten.has('arrowup')) dy -= v;
        if (tasten.has('s') || tasten.has('arrowdown')) dy += v;
        if (dx || dy){ this.kamera.x += dx; this.kamera.y += dy; this.begrenzen(); this.schmutzig = true; }
        requestAnimationFrame(scrollen);
      };
      requestAnimationFrame(scrollen);
    }
    setzeStil(name){ if (STILE[name]){ this.stil = STILE[name]; this.schmutzig = true; } }
  }

  window.EpochenKarte = { Karte, STILE, projY };
})();
