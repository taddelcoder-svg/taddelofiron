'use strict';
// Epochen – Einheiten auf der Karte: Zaehlsteine (NATO-Stil), Marschwege, Schlachten, Trefferflaechen.
(function(){
  const { TYPEN } = window.EpochenLogik;

  class EinheitenAnsicht {
    constructor(karte, spiel){
      this.karte = karte; this.spiel = spiel;
      this.auswahl = new Set();   // Einheiten-IDs
      this.treffer = [];          // Bildschirm-Rechtecke der Zaehlsteine
      karte.beiZeichnen = (c, ort, versaetze) => this.zeichnen(c, ort, versaetze);
      // Grenzboegen zwischen zwei Provinzen (fuer Frontlinien)
      this.paarBoegen = new Map();
      karte.bogenNutzer.forEach((nutzer, i) => {
        if (nutzer.length !== 2) return;
        const key = Math.min(...nutzer) + '|' + Math.max(...nutzer);
        (this.paarBoegen.get(key) || this.paarBoegen.set(key, []).get(key)).push(i);
      });
      this.gewaehlteArmee = null;
    }
    zeichneArmeen(c, ort, versaetze){
      const sp = this.spiel, k = this.karte;
      if (!sp.armeen) return;
      const projY = window.EpochenKarte.projY;
      for (const a of sp.armeen){
        if (a.staat !== sp.spieler) continue;
        const gewaehlt = this.gewaehlteArmee === a.id;
        const fp = sp.frontProvinzen(a);
        // Frontlinie: Grenzboegen zwischen Frontprovinz und gegnerischer Provinz
        c.lineCap = 'round'; c.lineJoin = 'round';
        for (const v of versaetze){
          c.beginPath();
          for (const f of fp) for (const n of sp.prov[f].nb){
            if (!sp.istFeindFuerFront(a.staat, sp.kontrolle[n])) continue;
            for (const bi of this.paarBoegen.get(Math.min(f, n) + '|' + Math.max(f, n)) || []){
              const b = k.boegen[bi];
              for (let j = 0; j < b.length; j += 2){ const q = ort(b[j], b[j + 1], v); j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }
            }
          }
          c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = gewaehlt ? 9 : 7; c.stroke();
          c.strokeStyle = gewaehlt ? '#ffd640' : '#3fb24f'; c.lineWidth = gewaehlt ? 5 : 3.5; c.stroke();
        }
        // Angriffspfeil
        if (a.pfeil) for (const v of versaetze){
          const pts = a.pfeil.punkte.map(([lon, lat]) => ort(lon, projY(lat), v));
          c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 12; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke();
          c.strokeStyle = gewaehlt ? '#ffd640' : '#d9432f'; c.lineWidth = 7; c.stroke();
          const n = pts.length; if (n >= 2) this.pfeil(c, pts[n - 2], pts[n - 1], c.strokeStyle, 22);
        }
        // Namensschild an der Front
        if (fp.length) for (const v of versaetze){
          const l = k.prov[fp[Math.floor(fp.length / 2)]].l, q = ort(l[0], l[1], v);
          const text = `${a.name} (${sp.armeeEinheiten(a).length})`;
          c.font = 'bold 12px system-ui, sans-serif'; const w = c.measureText(text).width;
          c.fillStyle = gewaehlt ? '#ffd640' : 'rgba(20,24,28,.85)'; c.fillRect(q[0] - w / 2 - 5, q[1] - 34, w + 10, 17);
          c.fillStyle = gewaehlt ? '#1b1a14' : '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, q[0], q[1] - 25.5);
        }
      }
    }
    stapel(){ // Provinz+Staat -> Einheiten
      const m = new Map();
      for (const u of this.spiel.einheiten){
        if (u.aufSee) continue;
        const k = u.prov + '|' + u.staat;
        (m.get(k) || m.set(k, []).get(k)).push(u);
      }
      return m;
    }
    trefferAn(p){
      for (let i = this.treffer.length - 1; i >= 0; i--){
        const r = this.treffer[i];
        if (p[0] >= r.x0 - 4 && p[0] <= r.x1 + 4 && p[1] >= r.y0 - 4 && p[1] <= r.y1 + 4) return r;
      }
      return null;
    }
    ausgewaehlt(){ return this.spiel.einheiten.filter(u => this.auswahl.has(u.id)); }
    // Flotten, Seeschlachten und Transporte auf See
    zeichneSee(c, ort, versaetze){
      const sp = this.spiel, k = this.karte, z = k.kamera.z;
      if (!sp.flotten || !k.meer) return;
      const B = k.cv.clientWidth, H = k.cv.clientHeight, spieler = sp.spieler, L = window.EpochenLogik;
      const zl = id => k.meer[id].l;
      // Fahrwege eigener Flotten
      for (const f of sp.flotten){
        if (f.staat !== spieler || !f.pfad.length) continue;
        for (const v of versaetze){
          const pts = [f.zone, ...f.pfad].map(id => ort(zl(id)[0], zl(id)[1], v));
          c.strokeStyle = this.flotteGewaehlt === f.id ? 'rgba(255,214,64,.95)' : 'rgba(20,40,60,.6)'; c.lineWidth = 2.5; c.setLineDash([6, 5]);
          c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); c.setLineDash([]);
          this.pfeil(c, pts[pts.length - 2], pts[pts.length - 1], c.strokeStyle, 9);
        }
      }
      // Transporte auf See
      const trans = new Map();
      for (const u of sp.einheiten){
        if (!u.aufSee) continue;
        const s = u.aufSee, t = Math.min(0.999, s.fort / s.dauer) * (s.zonen.length - 1), i = Math.floor(t), f = t - i;
        const a = zl(s.zonen[i]), b = zl(s.zonen[Math.min(s.zonen.length - 1, i + 1)]);
        const key = u.staat + '|' + s.ziel + '|' + i;
        if (!trans.has(key)) trans.set(key, { l:[a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], staat:u.staat, ids:[], landung:false });
        const e = trans.get(key); e.ids.push(u.id); if (u.landung) e.landung = true;
      }
      if (z >= 2.5) for (const v of versaetze) for (const t of trans.values()){
        if (t.staat !== spieler && !(spieler && sp.feind(spieler, t.staat)) && z < 20) continue;
        const [x, y] = ort(t.l[0], t.l[1], v);
        if (x < -30 || x > B + 30 || y < -30 || y > H + 30) continue;
        const gew = t.ids.some(i => this.auswahl.has(i));
        c.fillStyle = k.stil.land(k.staat(t.staat).f); c.strokeStyle = gew ? '#ffd640' : '#15120d'; c.lineWidth = gew ? 2.5 : 1.2;
        c.beginPath(); c.moveTo(x - 14, y - 6); c.lineTo(x + 10, y - 6); c.lineTo(x + 16, y); c.lineTo(x + 10, y + 6); c.lineTo(x - 14, y + 6); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#15120d'; c.font = 'bold 10px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText((t.landung ? 'L ' : '') + t.ids.length, x, y + 0.5);
        this.treffer.push({ x0:x - 14, y0:y - 7, x1:x + 16, y1:y + 7, prov:-1, staat:t.staat, ids:t.ids });
      }
      // Flotten
      if (z < 2.5) return;
      const proZone = new Map();
      for (const f of sp.flotten) (proZone.get(f.zone) || proZone.set(f.zone, []).get(f.zone)).push(f);
      for (const v of versaetze) for (const [zone, fs] of proZone){
        const [x0, y0] = ort(zl(zone)[0], zl(zone)[1], v);
        if (x0 < -60 || x0 > B + 60 || y0 < -40 || y0 > H + 40) continue;
        const kampf = fs.some(a => fs.some(b => sp.feind(a.staat, b.staat)));
        const zeigen = fs.filter(f => f.staat === spieler || (spieler && sp.feind(spieler, f.staat)) || z >= 12);
        zeigen.forEach((f, i) => {
          const x = x0 + (i - (zeigen.length - 1) / 2) * 44, y = y0 + 16;
          const gew = this.flotteGewaehlt === f.id, n = L.schiffAnzahl(f), nurUb = f.schiffe.ub === n;
          c.fillStyle = k.stil.land(k.staat(f.staat).f); c.strokeStyle = gew ? '#ffd640' : '#15120d'; c.lineWidth = gew ? 2.5 : 1.3;
          c.beginPath(); c.moveTo(x - 20, y - 8); c.lineTo(x + 14, y - 8); c.lineTo(x + 21, y); c.lineTo(x + 14, y + 8); c.lineTo(x - 20, y + 8); c.closePath(); c.fill(); c.stroke();
          c.fillStyle = '#15120d'; c.font = 'bold 11px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText((nurUb ? 'U ' : '') + n, x, y + 0.5);
          if (f.auftrag === 'hafen'){ c.fillStyle = '#15120d'; c.font = 'bold 10px system-ui, sans-serif'; c.fillText('H', x - 26, y); }
          const hp = L.staerkeFlotte(f, 'hp'); if (f.schaden > 0 && hp){ c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - 20, y + 9, 41, 3); c.fillStyle = '#e0503a'; c.fillRect(x - 20, y + 9, 41 * Math.min(1, f.schaden / hp * 3), 3); }
          this.treffer.push({ x0:x - 20, y0:y - 9, x1:x + 21, y1:y + 12, prov:-1, staat:f.staat, flotte:f.id, ids:[] });
        });
        if (kampf){
          c.save(); c.translate(x0, y0 - 6);
          c.fillStyle = 'rgba(160,20,20,.9)'; c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.fill();
          c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-5, -5); c.lineTo(5, 5); c.moveTo(5, -5); c.lineTo(-5, 5); c.stroke();
          c.restore();
        }
      }
    }

    zeichnen(c, ort, versaetze){
      const k = this.karte, s = k.stil, sp = this.spiel, z = k.kamera.z;
      const B = k.cv.clientWidth, H = k.cv.clientHeight;
      this.treffer = [];
      const spieler = sp.spieler;
      this.zeichneArmeen(c, ort, versaetze);
      const lp = id => k.prov[id].l;
      // 1. Marschwege der eigenen/ausgewaehlten Einheiten
      c.lineCap = 'round'; c.lineJoin = 'round';
      const wege = new Map();
      for (const u of sp.einheiten){
        if (!u.pfad.length || u.kampf) continue;
        if (u.staat !== spieler && !this.auswahl.has(u.id)) continue;
        const key = u.prov + '>' + u.pfad.join(',');
        if (!wege.has(key)) wege.set(key, { u, gewaehlt:this.auswahl.has(u.id) });
        else if (this.auswahl.has(u.id)) wege.get(key).gewaehlt = true;
      }
      for (const v of versaetze) for (const { u, gewaehlt } of wege.values()){
        const pts = [lp(u.prov), ...u.pfad.map(lp)].map(l => ort(l[0], l[1], v));
        c.strokeStyle = gewaehlt ? 'rgba(255,214,64,.95)' : 'rgba(30,30,30,.55)';
        c.lineWidth = gewaehlt ? 3 : 2; c.setLineDash([7, 5]);
        c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke();
        c.setLineDash([]);
        const a = pts[pts.length - 2], b = pts[pts.length - 1];
        this.pfeil(c, a, b, c.strokeStyle, 9);
      }
      // 2. Schlachten: Pfeil vom Angreifer zur umkaempften Provinz
      const schlachten = new Map();
      for (const u of sp.einheiten){
        if (!u.kampf || !u.pfad.length) continue;
        const key = u.prov + '>' + u.pfad[0];
        if (!schlachten.has(key)) schlachten.set(key, { von:u.prov, nach:u.pfad[0], staat:u.staat, n:0 });
        schlachten.get(key).n++;
      }
      for (const v of versaetze) for (const sl of schlachten.values()){
        const a = ort(...lp(sl.von), v), b = ort(...lp(sl.nach), v);
        if (Math.max(a[0], b[0]) < -50 || Math.min(a[0], b[0]) > B + 50 || Math.max(a[1], b[1]) < -50 || Math.min(a[1], b[1]) > H + 50) continue;
        const farbe = sl.staat === spieler ? '#1d8a3a' : '#c0271d';
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        c.strokeStyle = farbe; c.lineWidth = 4;
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(m[0] + (b[0] - a[0]) * 0.25, m[1] + (b[1] - a[1]) * 0.25); c.stroke();
        this.pfeil(c, a, [m[0] + (b[0] - a[0]) * 0.3, m[1] + (b[1] - a[1]) * 0.3], farbe, 11);
        // gekreuzte Klingen
        c.save(); c.translate(m[0], m[1]);
        c.fillStyle = 'rgba(20,20,20,.8)'; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-5, -5); c.lineTo(5, 5); c.moveTo(5, -5); c.lineTo(-5, 5); c.stroke();
        c.restore();
      }
      this.zeichneSee(c, ort, versaetze);
      // 3. Zaehlsteine
      if (z < 3.2) return;
      const gross = z > 30;
      const bw = gross ? 34 : 26, bh = gross ? 22 : 17;
      const proProv = new Map();
      for (const [key, us] of this.stapel()){ const p = us[0].prov; (proProv.get(p) || proProv.set(p, []).get(p)).push(us); }
      for (const v of versaetze) for (const [p, gruppen] of proProv){
        const [x0, y0] = ort(...lp(p), v);
        if (x0 < -40 || x0 > B + 40 || y0 < -40 || y0 > H + 40) continue;
        // bei weitem Zoom nur Stapel des Spielers und Staaten im Krieg
        gruppen.forEach((us, gi) => {
          const tag = us[0].staat;
          // Weit weg nur eigene Truppen und Kriegsgegner, mittel zusaetzlich alle Kriegsparteien, nah alles
          const wichtig = tag === spieler || (spieler && sp.feind(spieler, tag));
          if (!wichtig && (z < 26 || (z < 34 && !sp.imKrieg(tag)))) return;
          const x = x0 - bw / 2 + (gi - (gruppen.length - 1) / 2) * (bw + 3), y = y0 - bh / 2 + (gross ? 14 : 10);
          this.zaehlstein(c, x, y, bw, bh, us, tag);
          this.treffer.push({ x0:x, y0:y, x1:x + bw, y1:y + bh + 4, prov:p, staat:tag, ids:us.map(u => u.id) });
        });
      }
    }
    zaehlstein(c, x, y, bw, bh, us, tag){
      const k = this.karte, s = k.stil, st = k.staat(tag);
      const gewaehlt = us.some(u => this.auswahl.has(u.id));
      const pz = us.some(u => u.typ === 'pz'), kav = !pz && us.every(u => u.typ === 'kav'), art = !pz && us.some(u => u.typ === 'art');
      const kessel = us.some(u => u.abgeschnitten >= 1);
      c.fillStyle = s.land(st.f); c.strokeStyle = gewaehlt ? '#ffd640' : '#15120d'; c.lineWidth = gewaehlt ? 2.5 : 1.2;
      c.fillRect(x, y, bw, bh); c.strokeRect(x, y, bw, bh);
      // Symbolfeld links
      const sw = bh * 1.2, sx = x + 2, sy = y + 2, sh = bh - 4;
      c.strokeStyle = '#15120d'; c.lineWidth = 1;
      c.strokeRect(sx, sy, sw, sh);
      c.beginPath();
      if (pz){ c.ellipse(sx + sw / 2, sy + sh / 2, sw * 0.36, sh * 0.3, 0, 0, Math.PI * 2); }
      else if (kav){ c.moveTo(sx, sy + sh); c.lineTo(sx + sw, sy); }
      else { c.moveTo(sx, sy); c.lineTo(sx + sw, sy + sh); c.moveTo(sx + sw, sy); c.lineTo(sx, sy + sh); }
      c.stroke();
      if (art){ c.fillStyle = '#15120d'; c.beginPath(); c.arc(sx + sw / 2, sy + sh * 0.78, Math.max(1.5, sh * 0.13), 0, Math.PI * 2); c.fill(); }
      if (kessel){ c.strokeStyle = '#ff3b2f'; c.lineWidth = 2.5; c.strokeRect(x - 2, y - 2, bw + 4, bh + 9); }
      // Anzahl
      c.fillStyle = '#15120d'; c.font = `bold ${Math.round(bh * 0.62)}px system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(us.length), sx + sw + (x + bw - sx - sw) / 2, y + bh / 2 + 0.5);
      // Organisation (gruen) und Staerke (weiss) als Balken darunter
      const org = us.reduce((a, u) => a + u.org / TYPEN[u.typ].org, 0) / us.length;
      const stk = us.reduce((a, u) => a + u.staerke, 0) / us.length;
      c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x, y + bh, bw, 5);
      c.fillStyle = org > 0.5 ? '#4fc45a' : org > 0.2 ? '#e0b43a' : '#e0503a'; c.fillRect(x + 1, y + bh + 1, (bw - 2) * Math.max(0, org), 1.6);
      c.fillStyle = '#f0f0f0'; c.fillRect(x + 1, y + bh + 3, (bw - 2) * Math.max(0, stk), 1.4);
    }
    pfeil(c, a, b, farbe, g){
      const w = Math.atan2(b[1] - a[1], b[0] - a[0]);
      c.fillStyle = farbe; c.beginPath();
      c.moveTo(b[0], b[1]);
      c.lineTo(b[0] - g * Math.cos(w - 0.45), b[1] - g * Math.sin(w - 0.45));
      c.lineTo(b[0] - g * Math.cos(w + 0.45), b[1] - g * Math.sin(w + 0.45));
      c.closePath(); c.fill();
    }
  }
  window.EinheitenAnsicht = EinheitenAnsicht;
})();
