'use strict';
// Epochen – Fronten (Erweiterung von Spiel): Versorgung und Einkesselung, Winter und Schlamm,
// Armeen mit Generaelen, Frontlinien und Angriffspfeile, Armee-Automatik.
(function(global){
  const L = typeof module !== 'undefined' && module.exports ? require('./logik.js') : global.EpochenLogik;
  const { Spiel, TYPEN, GELAENDE, distKm } = L;
  const RAD = Math.PI / 180;

  const VERSORGUNG_KM = 2600;        // ab Versorgungsknoten; danach nur noch Grundversorgung
  const FRONT_KM = 170;              // Provinzen so nah an der gezeichneten Linie gehoeren zur Front
  const MAX_ARMEE = 24;
  const EIGENSCHAFTEN = {
    panzer:{ n:'Panzerführer', text:'+15 % Angriff mit Panzern' },
    verteidiger:{ n:'Verteidiger', text:'+15 % Verteidigung' },
    winter:{ n:'Winterexperte', text:'halbe Winter-Nachteile' },
    angreifer:{ n:'Draufgänger', text:'+10 % Angriff' },
    logistik:{ n:'Logistiker', text:'keine Überlastung der Versorgung' }
  };
  // Generaele: erfundene Namen je Sprachraum (keine realen Personen)
  const NAMEN = {
    de:['Albrecht', 'Brenner', 'Carstens', 'Dorn', 'Eggert', 'Falkenrath', 'Grauert', 'Hollmann', 'Imhoff', 'Kessler', 'Lindemann', 'Reuter'],
    fr:['Aubert', 'Bastide', 'Chevalier', 'Delorme', 'Fournier', 'Garnier', 'Lambert', 'Marchand', 'Roussel', 'Vasseur'],
    en:['Ashford', 'Barrington', 'Colville', 'Denholm', 'Fairfax', 'Hargreaves', 'Kingsley', 'Merriman', 'Pembroke', 'Whitcombe'],
    ru:['Arsenjew', 'Below', 'Gromow', 'Kasakow', 'Lebedew', 'Morosow', 'Orlow', 'Sokolow', 'Tichonow', 'Wolkow'],
    it:['Amadei', 'Bellini', 'Castelli', 'Donati', 'Ferraro', 'Galli', 'Marchetti', 'Rinaldi', 'Serra', 'Vitale'],
    ja:['Aoki', 'Fujimura', 'Hayashi', 'Ishida', 'Kaneko', 'Matsuda', 'Nakamura', 'Ogawa', 'Sakai', 'Takeda'],
    zh:['Bai', 'Chen', 'Du', 'Guo', 'Han', 'Li', 'Ma', 'Song', 'Wang', 'Zhou'],
    pl:['Bielski', 'Dąbrowa', 'Górecki', 'Kowalczyk', 'Lis', 'Nowicki', 'Ostrowski', 'Sadowski', 'Wróbel', 'Zając'],
    es:['Alvarado', 'Barrios', 'Cortés', 'Delgado', 'Estrada', 'Fuentes', 'Herrera', 'Medina', 'Navarro', 'Robles'],
    x:['Adler', 'Berg', 'Carr', 'Dal', 'Ek', 'Falk', 'Holm', 'Kral', 'Lind', 'Nord', 'Ost', 'Stern']
  };
  const SPRACHE = { GER:'de', AUT:'de', SWI:'de', FRA:'fr', BEL:'fr', LUX:'fr', ENG:'en', CAN:'en', AST:'en', NZL:'en', USA:'en', IRE:'en',
    SAF:'en', RAJ:'en', SOV:'ru', ITA:'it', JAP:'ja', MAN:'ja', CHI:'zh', SIK:'zh', YUN:'zh', GXC:'zh', XSM:'zh', SHX:'zh', POL:'pl',
    SPA:'es', MEX:'es', ARG:'es', CHL:'es', PRU:'es', COL:'es', VEN:'es', BOL:'es', PAR:'es', URU:'es', ECU:'es', CUB:'es' };

  // Abstand Punkt–Linienzug in km (lon/lat, lokal eben)
  function abstandLinie(p, pts){
    if (!pts.length) return Infinity;
    if (pts.length === 1) return distKm(p, pts[0]);
    let best = Infinity;
    const k = Math.cos(p[1] * RAD) * 111, g = 111;
    for (let i = 0; i < pts.length - 1; i++){
      const ax = (pts[i][0] - p[0]) * k, ay = (pts[i][1] - p[1]) * g, bx = (pts[i + 1][0] - p[0]) * k, by = (pts[i + 1][1] - p[1]) * g;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
    return best;
  }
  // Position entlang eines Linienzugs (0 = Anfang, 1 = Ende) – fuer die Reihenfolge der Pfeilziele
  function anteilLinie(p, pts){
    let best = Infinity, pos = 0, gesamt = 0; const seg = [];
    for (let i = 0; i < pts.length - 1; i++){ const l = distKm(pts[i], pts[i + 1]); seg.push(l); gesamt += l; }
    let bis = 0;
    for (let i = 0; i < pts.length - 1; i++){
      for (let t = 0; t <= 1; t += 0.1){
        const q = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
        const d = distKm(p, q); if (d < best){ best = d; pos = (bis + seg[i] * t) / (gesamt || 1); }
      }
      bis += seg[i];
    }
    return pos;
  }

  Object.assign(Spiel.prototype, {
    // ---------- Wetter ----------
    wetterAm(p){
      const m = this.datum().getUTCMonth(), [lon, lat] = this.prov[p].l, t = this.prov[p].t;
      if ((m >= 10 || m <= 2) && (lat >= 47 || (lat >= 40 && (t === 'berg' || t === 'tundra')))) return 'winter';
      if (m >= 5 && m <= 7 && lat <= -42) return 'winter';
      if ((m === 3 || m === 9) && lon >= 20 && lon <= 60 && lat >= 45 && lat <= 62) return 'schlamm';
      return null;
    },
    wetter(p){ return this._wetter ? this._wetter[p] : null; },
    wetterFaktorWeg(p){ const w = this.wetter(p); return w === 'winter' ? 1.5 : w === 'schlamm' ? 2 : 1; },

    // ---------- Versorgung (taeglich) ----------
    wetterBerechnen(){ const n = this.prov.length; this._wetter = new Array(n); for (let p = 0; p < n; p++) this._wetter[p] = this.wetterAm(p); },
    frontenTag(){
      const n = this.prov.length;
      this.wetterBerechnen();
      const tags = new Set(this.einheiten.map(u => u.staat));
      this.versorgung = this.versorgung || {};
      for (const tag of tags){
        const s = this.staaten[tag]; if (!s) continue;
        const d = new Float64Array(n).fill(Infinity), heap = new L.Heap();
        const quelle = p => { d[p] = 0; heap.push(p, 0); };
        const hsTags = [tag]; if (s.oberherr) hsTags.push(s.oberherr);
        for (const t of hsTags){ const hs = this.staaten[t].hauptstadt; if (this.freund(this.kontrolle[hs], tag)) quelle(hs); }
        // Haefen: eigene Kuestenprovinzen im Kernland (bis es in 0.5 Flotten gibt)
        for (let p = 0; p < n; p++) if (this.prov[p].k && this.kontrolle[p] === tag && this.besitz[p] === tag && d[p]) quelle(p);
        while (heap.size){
          const [p, dp] = heap.pop(); if (dp > d[p]) continue;
          const nb = this.prov[p].nb;
          for (let i = 0; i < nb.length; i++){
            const q = nb[i]; if (!this.freund(this.kontrolle[q], tag)) continue;
            const nd = dp + this.nbKm[p][i] * (1.6 - 0.2 * this.infra[q]);
            if (nd < d[q]){ d[q] = nd; heap.push(q, nd); }
          }
        }
        const v = new Float32Array(n);
        for (let p = 0; p < n; p++) v[p] = d[p] === Infinity ? 0 : Math.max(0.35, 1 - d[p] / VERSORGUNG_KM);
        this.versorgung[tag] = v;
      }
      // Einheiten: Versorgung, Ueberlastung, Einkesselung
      const proProv = new Map();
      for (const u of this.einheiten){ const k = u.prov + '|' + u.staat; proProv.set(k, (proProv.get(k) || 0) + 1); }
      for (const u of this.einheiten){
        const v = this.versorgung[u.staat] ? this.versorgung[u.staat][u.prov] : 1;
        u.vers = Math.round(v * 100) / 100;
        u.abgeschnitten = v === 0 ? (u.abgeschnitten || 0) + 1 : 0;
        const g = this.generalVon(u);
        u.ueberlast = !(g && g.eigenschaft === 'logistik') && proProv.get(u.prov + '|' + u.staat) > 4 + 2 * this.infra[u.prov];
        if (u.abgeschnitten >= 3){
          u.staerke -= 0.02; u.org = Math.max(0, u.org - 2);
          if (u.abgeschnitten === 3 && u.staat === this.spieler) this.meldung(`Truppen in ${this.provName ? this.provName(u.prov) : u.prov} sind eingekesselt!`);
          if (u.staerke <= 0.05) this.vernichten(u, 'im Kessel aufgerieben');
        }
      }
    },
    // Faktor fuer Kraftwerte (Versorgung + General)
    kraftFaktor(u, wert){
      let f = 1;
      if (u.abgeschnitten >= 3) f *= 0.5;
      else if (u.vers !== undefined && u.vers < 0.6) f *= 0.7 + 0.5 * u.vers;
      const g = this.generalVon(u);
      if (g){
        f *= 1 + 0.04 * (g.fertigkeit - 1);
        if (wert === 'angriff' && (g.eigenschaft === 'angreifer' || (g.eigenschaft === 'panzer' && u.typ === 'pz'))) f *= g.eigenschaft === 'panzer' ? 1.15 : 1.1;
        if (wert === 'verteidigung' && g.eigenschaft === 'verteidiger') f *= 1.15;
      }
      return f;
    },
    erholFaktor(u){ return u.abgeschnitten >= 3 ? 0 : u.ueberlast ? 0.5 : 1; },
    winterFaktor(p, angreifer){
      if (this.wetter(p) !== 'winter') return 1;
      const g = angreifer.length && this.generalVon(angreifer[0]);
      return g && g.eigenschaft === 'winter' ? 0.85 : 0.7;
    },

    // ---------- Armeen ----------
    generalVon(u){ if (!u.armee || !this.armeen) return null; const a = this.armeeMit(u.armee); return a ? a.general : null; },
    armeeMit(id){ return (this.armeen || []).find(a => a.id === id) || null; },
    neuerGeneral(tag){
      const liste = NAMEN[SPRACHE[tag] || 'x'], e = Object.keys(EIGENSCHAFTEN);
      const vorn = 'ABCDEFGHJKLMNOPRSTW'[Math.floor(this.rnd() * 19)];
      return { name:`${vorn}. ${liste[Math.floor(this.rnd() * liste.length)]}`, fertigkeit:1 + Math.floor(this.rnd() * 4), eigenschaft:e[Math.floor(this.rnd() * e.length)] };
    },
    armeeBilden(tag, ids){
      this.armeen = this.armeen || []; this.naechsteArmee = this.naechsteArmee || 1;
      const us = this.einheiten.filter(u => u.staat === tag && ids.includes(u.id)).slice(0, MAX_ARMEE);
      if (!us.length) return null;
      const nr = 1 + Math.max(0, ...this.armeen.filter(a => a.staat === tag).map(a => a.nr));
      const a = { id:this.naechsteArmee++, staat:tag, nr, name:`${nr}. Armee`, general:this.neuerGeneral(tag), front:null, pfeil:null, automatik:false };
      this.armeen.push(a);
      for (const u of us){ u.armee = a.id; u.manuell = false; }
      this.armeenAufraeumen();
      return a;
    },
    armeeAufloesen(id){
      for (const u of this.einheiten) if (u.armee === id) u.armee = null;
      this.armeen = (this.armeen || []).filter(a => a.id !== id);
    },
    armeeEinheiten(a){ return this.einheiten.filter(u => u.armee === a.id); },
    armeenAufraeumen(){ // leere Armeen entfernen
      if (!this.armeen) return;
      const benutzt = new Set(this.einheiten.map(u => u.armee).filter(Boolean));
      this.armeen = this.armeen.filter(a => benutzt.has(a.id));
    },
    frontSetzen(id, punkte){
      const a = this.armeeMit(id); if (!a || !punkte.length) return false;
      a.front = { punkte:punkte.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) };
      return this.frontProvinzen(a).length > 0;
    },
    pfeilSetzen(id, punkte){
      const a = this.armeeMit(id); if (!a || punkte.length < 2) return false;
      a.pfeil = { punkte:punkte.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) };
      if (!a.front) a.front = { punkte:[a.pfeil.punkte[0]] };
      return true;
    },
    frontLoeschen(id){ const a = this.armeeMit(id); if (a){ a.front = null; a.pfeil = null; } },
    // Gegner der Front: Kriegsgegner, sonst alle fremden Nachbarn (Grenzwache im Frieden)
    istFeindFuerFront(tag, k){ return this.feind(tag, k) || (!this.imKrieg(tag) && !this.lager(tag).has(k)); },
    frontProvinzen(a){
      if (!a.front) return [];
      const schluessel = this.stunde + '|' + JSON.stringify(a.front) + JSON.stringify(a.pfeil);
      if (a._fp && a._fp.s === schluessel) return a._fp.l;
      const l = this.frontProvinzenNeu(a);
      Object.defineProperty(a, '_fp', { value:{ s:schluessel, l }, writable:true, configurable:true, enumerable:false });
      return l;
    },
    frontProvinzenNeu(a){
      const zone = a.front.punkte.concat(a.pfeil ? a.pfeil.punkte : []);
      const out = [];
      for (let p = 0; p < this.prov.length; p++){
        if (!this.freund(this.kontrolle[p], a.staat)) continue;
        if (!this.prov[p].nb.some(n => this.istFeindFuerFront(a.staat, this.kontrolle[n]))) continue;
        const d = Math.min(abstandLinie(this.prov[p].l, a.front.punkte), a.pfeil ? abstandLinie(this.prov[p].l, a.pfeil.punkte) : Infinity);
        if (d <= FRONT_KM) out.push(p);
      }
      return out;
    },
    // Alle 6 Stunden: Armeen mit Front verteilen sich, mit Pfeil greifen sie an
    armeenSchritt(){
      if (!this.armeen || !this.armeen.length) return;
      this.armeenAufraeumen();
      for (const a of this.armeen){
        if (a.automatik || (a.staat !== this.spieler && !a.front)) continue;
        const us = this.armeeEinheiten(a).filter(u => !(u.manuell && u.pfad.length));
        us.forEach(u => { if (u.manuell && !u.pfad.length) u.manuell = false; });
        const fp = this.frontProvinzen(a);
        if (!fp.length || !us.length) continue;
        this.frontVerteilen(a, us, fp);
        if (a.pfeil) this.pfeilAngriff(a, us, fp);
      }
    },
    feindStaerke(tag, p){ return this.einheiten.reduce((s, v) => v.prov === p && this.feind(tag, v.staat) ? s + this.kraft(v, 'verteidigung') : s, 0); },
    frontVerteilen(a, us, fp){
      const tag = a.staat, fpSet = new Set(fp);
      // Gewicht je Frontprovinz nach Bedrohung
      const gew = fp.map(p => 1 + this.prov[p].nb.reduce((s, n) => s + (this.feind(tag, this.kontrolle[n]) ? this.feindStaerke(tag, n) / 12 : 0), 0));
      const summe = gew.reduce((x, y) => x + y, 0);
      const soll = new Map(fp.map((p, i) => [p, Math.max(us.length >= fp.length ? 1 : 0, Math.round(gew[i] / summe * us.length))]));
      const ist = new Map(fp.map(p => [p, 0]));
      const frei = [];
      for (const u of us){
        if (u.kampf || u.pfad.length && u.pfad.length === 1 && this.feind(tag, this.kontrolle[u.pfad[0]])) continue; // greift an
        const ziel = u.pfad.length ? u.pfad[u.pfad.length - 1] : u.prov;
        if (fpSet.has(ziel) && ist.get(ziel) < soll.get(ziel)){ ist.set(ziel, ist.get(ziel) + 1); continue; }
        frei.push(u);
      }
      for (const u of frei){
        let best = -1, bd = Infinity;
        for (const p of fp){
          if (ist.get(p) >= soll.get(p)) continue;
          const d = distKm(this.prov[p].l, this.prov[u.prov].l); if (d < bd){ bd = d; best = p; }
        }
        if (best < 0) break;
        const pfad = this.weg(u, best);
        if (pfad){ u.pfad = pfad; u.fort = 0; ist.set(best, ist.get(best) + 1); }
      }
    },
    pfeilAngriff(a, us, fp){
      const tag = a.staat, pts = a.pfeil.punkte;
      for (const f of fp){
        const hier = us.filter(u => u.prov === f && !u.pfad.length && u.org > TYPEN[u.typ].org * 0.5);
        if (!hier.length) continue;
        const ziele = this.prov[f].nb.filter(n => this.feind(tag, this.kontrolle[n]) && abstandLinie(this.prov[n].l, pts) <= FRONT_KM);
        if (!ziele.length) continue;
        // Ziel: am weitesten entlang des Pfeils
        ziele.sort((x, y) => anteilLinie(this.prov[y].l, pts) - anteilLinie(this.prov[x].l, pts));
        const z = ziele[0], feindK = this.feindStaerke(tag, z);
        const andereFeinde = this.prov[f].nb.some(n => n !== z && this.feind(tag, this.kontrolle[n]));
        const angreifer = andereFeinde && hier.length > 1 ? hier.slice(1) : hier;
        const kraft = angreifer.reduce((s, u) => s + this.kraft(u, 'angriff'), 0) * GELAENDE[this.prov[z].t].angriff;
        if (feindK === 0 || kraft / feindK >= 1.0) angreifer.forEach(u => { u.pfad = [z]; u.fort = 0; });
      }
    },
    frontenStand(){ return { armeen:JSON.parse(JSON.stringify(this.armeen || [])), naechsteArmee:this.naechsteArmee || 1 }; },
    ladeFronten(d){ this.armeen = d.armeen || []; this.naechsteArmee = d.naechsteArmee || 1; }
  });

  Object.assign(L, { EIGENSCHAFTEN, abstandLinie, FRONT_KM });
})(typeof window !== 'undefined' ? window : globalThis);
