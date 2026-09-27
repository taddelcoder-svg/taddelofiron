'use strict';
// Epochen – Spielregeln (rein, deterministisch). Laeuft im Browser und spaeter auf dem Server.
// Zeit laeuft in Stunden. Einheiten = Divisionen; Bewegung ueber das Provinz-Netz;
// Kampf stuendlich; Kapitulation, wenn ein Staat den Grossteil seines Kernlands verliert.
(function(global){
  const RAD = Math.PI / 180;

  // Einheitentypen (Werte je Division)
  const TYPEN = {
    inf:{ n:'Infanterie', kurz:'Inf', angriff:6, verteidigung:14, org:40, tempo:4, panzerung:0, durchschlag:4 },
    kav:{ n:'Kavallerie', kurz:'Kav', angriff:7, verteidigung:10, org:35, tempo:6, panzerung:0, durchschlag:4 },
    pz:{ n:'Panzer', kurz:'Pz', angriff:24, verteidigung:8, org:30, tempo:8, panzerung:30, durchschlag:30 }
  };

  // Gelaende: Angriffs-Faktor und Bewegungskosten
  const GELAENDE = {
    ebene:{ n:'Ebene', angriff:1, weg:1 }, wald:{ n:'Wald', angriff:0.8, weg:1.3 }, huegel:{ n:'Hügel', angriff:0.75, weg:1.4 },
    berg:{ n:'Gebirge', angriff:0.5, weg:2 }, sumpf:{ n:'Sumpf', angriff:0.6, weg:1.8 }, wueste:{ n:'Wüste', angriff:0.9, weg:1.2 },
    dschungel:{ n:'Dschungel', angriff:0.65, weg:1.8 }, tundra:{ n:'Tundra', angriff:0.85, weg:1.5 }
  };
  const KAMPFBREITE = 6; // max. Angreifer je Schlacht

  // Streitkraefte 1936 (Divisionen, grob nach Hearts-of-Iron-Groessenordnung) und Qualitaet
  const ARMEEN = {
    GER:{ inf:26, pz:3, q:1.1 }, FRA:{ inf:38, kav:3, pz:2, q:0.95 }, ENG:{ inf:14, pz:1, q:1.0 }, RAJ:{ inf:10, kav:2, q:0.8 },
    SOV:{ inf:62, kav:6, pz:4, q:0.9 }, ITA:{ inf:24, q:0.85 }, JAP:{ inf:22, q:1.05 }, CHI:{ inf:40, q:0.65 },
    USA:{ inf:8, q:0.95 }, POL:{ inf:28, kav:4, q:0.85 }, CZE:{ inf:18, pz:1, q:0.9 }, ROM:{ inf:18, kav:2, q:0.75 },
    YUG:{ inf:16, q:0.75 }, TUR:{ inf:16, q:0.8 }, SPA:{ inf:14, q:0.75 }, HUN:{ inf:7, q:0.85 }, BUL:{ inf:7, q:0.8 },
    GRE:{ inf:8, q:0.8 }, BEL:{ inf:10, q:0.9 }, HOL:{ inf:7, q:0.85 }, SWE:{ inf:7, q:0.9 }, SWI:{ inf:7, q:0.95 },
    FIN:{ inf:8, q:1.0 }, AUT:{ inf:5, q:0.85 }, POR:{ inf:5, q:0.75 }, NOR:{ inf:4, q:0.85 }, DEN:{ inf:2, q:0.85 },
    MAN:{ inf:8, q:0.6 }, SIK:{ inf:5, q:0.55 }, YUN:{ inf:5, q:0.55 }, GXC:{ inf:6, q:0.6 }, XSM:{ inf:5, kav:2, q:0.55 },
    SHX:{ inf:6, q:0.55 }, ETH:{ inf:10, q:0.5 }, BRA:{ inf:9, q:0.7 }, ARG:{ inf:7, q:0.75 }, CAN:{ inf:3, q:0.95 },
    AST:{ inf:3, q:0.95 }, MEX:{ inf:6, q:0.65 }, IRN:{ inf:7, q:0.65 }, IRQ:{ inf:3, q:0.6 }, SAU:{ inf:3, kav:2, q:0.55 },
    EST:{ inf:3, q:0.85 }, LAT:{ inf:3, q:0.85 }, LIT:{ inf:3, q:0.85 }, ALB:{ inf:2, q:0.6 }, SIA:{ inf:5, q:0.65 },
    MON:{ inf:2, kav:3, q:0.6 }, AFG:{ inf:4, q:0.55 }, EGY:{ inf:3, q:0.6 }, IRE:{ inf:2, q:0.8 }, SAF:{ inf:3, q:0.9 },
    NZL:{ inf:1, q:0.95 }, CHL:{ inf:5, q:0.75 }, PRU:{ inf:4, q:0.65 }, COL:{ inf:3, q:0.65 }, VEN:{ inf:3, q:0.6 }
  };
  // Kriege, die am 1. Januar 1936 schon laufen (Abessinienkrieg) und Truppen dafuer
  const START = { kriege:[['ITA', 'ETH']], aufmarsch:[{ staat:'ITA', gegen:'ETH', inf:10 }] };

  // Kleiner Binaer-Heap fuer die Wegsuche
  class Heap {
    constructor(){ this.k = []; this.w = []; }
    get size(){ return this.k.length; }
    push(k, w){
      const K = this.k, W = this.w; let i = K.length; K.push(k); W.push(w);
      while (i > 0){ const p = (i - 1) >> 1; if (W[p] <= w) break; K[i] = K[p]; W[i] = W[p]; i = p; }
      K[i] = k; W[i] = w;
    }
    pop(){
      const K = this.k, W = this.w, top = [K[0], W[0]], k = K.pop(), w = W.pop();
      if (K.length){
        let i = 0; const n = K.length;
        while (true){ let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && W[c + 1] < W[c]) c++; if (W[c] >= w) break; K[i] = K[c]; W[i] = W[c]; i = c; }
        K[i] = k; W[i] = w;
      }
      return top;
    }
  }

  function zufall(seed){ let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function distKm(a, b){
    const dl = (b[0] - a[0]) * RAD * Math.cos((a[1] + b[1]) / 2 * RAD), dp = (b[1] - a[1]) * RAD;
    return Math.hypot(dl, dp) * 6371;
  }

  class Spiel {
    constructor(prov, welt, opt = {}){
      this.prov = prov.map((p, i) => ({ id:i, l:p.l, nb:p.nb, a:p.a, t:p.t || 'ebene' }));
      this.nbKm = this.prov.map(p => p.nb.map(n => Math.max(40, distKm(p.l, this.prov[n].l))));
      this.staaten = {};
      for (const [tag, s] of Object.entries(welt.staaten)) this.staaten[tag] = { tag, n:s.n, hauptstadt:s.hauptstadt, oberherr:s.oberherr || null, kapituliert:false };
      this.besitz = welt.besitz.slice();       // Kernland (wem die Provinz gehoert)
      this.kontrolle = welt.besitz.slice();    // wer sie gerade haelt
      this.stunde = 0; this.start = Date.UTC(1936, 0, 1);
      this.kriege = new Set();
      this.einheiten = []; this.naechsteId = 1;
      this.spieler = opt.spieler || null;
      this.rnd = zufall(opt.seed || 1936);
      this.meldungen = []; this.beiMeldung = null;
      this.aenderung = true; // Kontrolle hat sich geaendert (Karte neu aufbauen)
      this.aufstellen();
      for (const [a, b] of START.kriege) this.kriegErklaeren(a, b, true);
    }

    // ---------- Hilfen ----------
    datum(){ return new Date(this.start + this.stunde * 3600e3); }
    lager(tag){ // Staat + Oberherr + dessen Untertanen (zwischengespeichert)
      const c = (this._lager || (this._lager = {}))[tag]; if (c) return c;
      return (this._lager[tag] = this.lagerNeu(tag));
    }
    lagerNeu(tag){
      const s = this.staaten[tag]; const kopf = s && s.oberherr ? s.oberherr : tag;
      const out = new Set([kopf]);
      for (const t in this.staaten) if (this.staaten[t].oberherr === kopf) out.add(t);
      return out;
    }
    key(a, b){ return a < b ? a + '|' + b : b + '|' + a; }
    feind(a, b){ if (a === b) return false; const f = this.feindMap()[a]; return !!f && f.has(b); }
    feindMap(){
      if (this._feind) return this._feind;
      const m = {};
      for (const k of this.kriege){ const [a, b] = k.split('|'); (m[a] || (m[a] = new Set())).add(b); (m[b] || (m[b] = new Set())).add(a); }
      return (this._feind = m);
    }
    freund(a, b){ return a === b || (!this.feind(a, b) && this.lager(a).has(b)); }
    imKrieg(tag){ for (const k of this.kriege){ const [a, b] = k.split('|'); if (a === tag || b === tag) return true; } return false; }
    gegner(tag){ const out = []; for (const k of this.kriege){ const [a, b] = k.split('|'); if (a === tag) out.push(b); else if (b === tag) out.push(a); } return out; }
    meldung(text, wichtig){ const m = { stunde:this.stunde, text, wichtig:!!wichtig }; this.meldungen.push(m); if (this.meldungen.length > 60) this.meldungen.shift(); if (this.beiMeldung) this.beiMeldung(m); }
    einheitenIn(p){ return this.einheiten.filter(u => u.prov === p); }
    typ(u){ return TYPEN[u.typ]; }
    q(tag){ return (ARMEEN[tag] && ARMEEN[tag].q) || 0.7; }
    kraft(u, wert){ const t = TYPEN[u.typ]; return t[wert] * this.q(u.staat) * (0.25 + 0.75 * u.staerke) * (0.25 + 0.75 * Math.max(0, u.org) / t.org); }

    // ---------- Aufstellung ----------
    neueEinheit(staat, typ, prov){
      const u = { id:this.naechsteId++, staat, typ, prov, org:TYPEN[typ].org, staerke:1, pfad:[], fort:0, kampf:false, schanz:0.5 };
      this.einheiten.push(u); return u;
    }
    aufstellen(){
      const eigene = {};
      this.besitz.forEach((t, i) => (eigene[t] || (eigene[t] = [])).push(i));
      for (const tag in this.staaten){
        const provs = eigene[tag]; if (!provs) continue;
        const a = ARMEEN[tag] || { inf:Math.max(1, Math.min(5, Math.round(provs.length / 4))) };
        // Kerngebiet = mit der Hauptstadt verbundene Provinzen, Rest = Kolonien/Inseln
        const hs = this.staaten[tag].hauptstadt, kern = this.gebiet(hs, tag);
        const rand = kern.filter(i => this.prov[i].nb.some(n => this.besitz[n] !== tag));
        const innen = kern.filter(i => !rand.includes(i)).sort((x, y) => distKm(this.prov[x].l, this.prov[hs].l) - distKm(this.prov[y].l, this.prov[hs].l));
        const plaetze = [hs, ...rand.filter(i => i !== hs), ...innen.filter(i => i !== hs)];
        let k = 0;
        for (const typ of ['pz', 'kav', 'inf']) for (let n = 0; n < (a[typ] || 0); n++) this.neueEinheit(tag, typ, plaetze[k++ % plaetze.length]);
        // Je eine Garnison in groesseren Kolonien
        const gesehen = new Set(kern);
        for (const i of provs){
          if (gesehen.has(i)) continue;
          const g = this.gebiet(i, tag); g.forEach(x => gesehen.add(x));
          if (g.length >= 4 && ARMEEN[tag]) this.neueEinheit(tag, 'inf', g[0]);
        }
      }
      for (const z of START.aufmarsch){
        const ziel = this.besitz.map((t, i) => t === z.gegen ? i : -1).filter(i => i >= 0);
        const nah = this.besitz.map((t, i) => t === z.staat && this.prov[i].nb.some(n => ziel.includes(n)) ? i : -1).filter(i => i >= 0);
        for (let n = 0; n < z.inf && nah.length; n++) this.neueEinheit(z.staat, 'inf', nah[n % nah.length]);
      }
    }
    gebiet(start, tag){ // zusammenhaengende Provinzen eines Besitzers
      const out = [start], seen = new Set(out);
      for (let i = 0; i < out.length; i++) for (const n of this.prov[out[i]].nb) if (!seen.has(n) && this.besitz[n] === tag){ seen.add(n); out.push(n); }
      return out;
    }

    // ---------- Diplomatie ----------
    kriegErklaeren(a, b, still){
      if (!this.staaten[a] || !this.staaten[b] || this.freund(a, b) && this.lager(a).has(b)) return false;
      const A = this.lager(a), B = this.lager(b);
      for (const x of A) for (const y of B) if (!this.staaten[x].kapituliert && !this.staaten[y].kapituliert) this._feind = null, this.kriege.add(this.key(x, y));
      if (!still) this.meldung(`${this.staaten[a].n} erklärt ${this.staaten[b].n} den Krieg.`, true);
      else this.meldung(`Krieg: ${this.staaten[a].n} gegen ${this.staaten[b].n}.`);
      return true;
    }
    kapitulation(tag){
      const s = this.staaten[tag]; if (s.kapituliert) return;
      const feinde = this.gegner(tag);
      // Besatzer = Feind, der am meisten Kernland haelt
      const zaehl = {};
      this.besitz.forEach((t, i) => { if (t === tag && feinde.includes(this.kontrolle[i])) zaehl[this.kontrolle[i]] = (zaehl[this.kontrolle[i]] || 0) + 1; });
      const sieger = Object.keys(zaehl).sort((x, y) => zaehl[y] - zaehl[x])[0] || feinde[0];
      this.kontrolle.forEach((t, i) => { if (t === tag) this.kontrolle[i] = sieger; });
      this.einheiten = this.einheiten.filter(u => u.staat !== tag);
      for (const k of [...this.kriege]) if (k.split('|').includes(tag)) (this._feind = null, this.kriege.delete(k));
      s.kapituliert = true; this.aenderung = true;
      this.meldung(`${s.n} kapituliert vor ${this.staaten[sieger].n}.`, true);
      // Untertanen fallen mit
      for (const t in this.staaten) if (this.staaten[t].oberherr === tag && this.imKrieg(t)) this.kapitulation(t);
    }
    pruefeKapitulation(){
      const kern = {}, gehalten = {};
      this.besitz.forEach((t, i) => { kern[t] = (kern[t] || 0) + 1; if (this.freund(this.kontrolle[i], t)) gehalten[t] = (gehalten[t] || 0) + 1; });
      for (const tag in this.staaten){
        const s = this.staaten[tag]; if (s.kapituliert || !this.imKrieg(tag) || !kern[tag]) continue;
        const anteil = (gehalten[tag] || 0) / kern[tag];
        const hsWeg = !this.freund(this.kontrolle[s.hauptstadt], tag);
        if (anteil <= 0.3 || (hsWeg && anteil <= 0.6)) this.kapitulation(tag);
      }
    }

    // ---------- Befehle ----------
    betretbar(tag, p){ const k = this.kontrolle[p]; return this.freund(tag, k) || this.feind(tag, k); }
    wegKosten(u, von, i){ const nach = this.prov[von].nb[i]; return this.nbKm[von][i] / TYPEN[u.typ].tempo * GELAENDE[this.prov[nach].t].weg; }
    weg(u, ziel){ // Dijkstra ueber freundliche und feindliche Provinzen
      if (ziel === u.prov) return [];
      if (!this.betretbar(u.staat, ziel)) return null;
      const n = this.prov.length, d = new Float64Array(n).fill(Infinity), vor = new Int32Array(n).fill(-1);
      const heap = new Heap(); heap.push(u.prov, 0); d[u.prov] = 0;
      while (heap.size){
        const [p, dp] = heap.pop();
        if (dp > d[p]) continue;
        if (p === ziel) break;
        const nb = this.prov[p].nb;
        for (let i = 0; i < nb.length; i++){
          const q = nb[i]; if (!this.betretbar(u.staat, q)) continue;
          // durch Feindesland nur als letzter Schritt oder wenn dort kein Feind steht
          const nd = d[p] + this.wegKosten(u, p, i) * (this.feind(u.staat, this.kontrolle[q]) ? 1.5 : 1);
          if (nd < d[q]){ d[q] = nd; vor[q] = p; heap.push(q, nd); }
        }
      }
      if (vor[ziel] < 0) return null;
      const pfad = []; for (let p = ziel; p !== u.prov; p = vor[p]) pfad.unshift(p);
      return pfad;
    }
    bewegen(ids, ziel){
      let ok = 0;
      for (const u of this.einheiten){
        if (!ids.includes(u.id)) continue;
        const pfad = this.weg(u, ziel);
        if (pfad){ u.pfad = pfad; u.fort = 0; ok++; }
      }
      return ok;
    }
    anhalten(ids){ for (const u of this.einheiten) if (ids.includes(u.id)){ u.pfad = []; u.fort = 0; } }

    // ---------- Simulation ----------
    schritt(){ // eine Stunde
      this.stunde++;
      const kaempfe = new Map(); // Provinz -> Angreifer
      const proProv = new Map();
      for (const v of this.einheiten) (proProv.get(v.prov) || proProv.set(v.prov, []).get(v.prov)).push(v);
      const hatFeind = (tag, p) => (proProv.get(p) || []).some(v => this.feind(tag, v.staat));
      for (const u of this.einheiten){
        u.kampf = false;
        if (!u.pfad.length){ this.erholen(u, 1); u.schanz = Math.min(1, u.schanz + 0.01); continue; }
        const nxt = u.pfad[0];
        if (!this.betretbar(u.staat, nxt)){ u.pfad = []; u.fort = 0; continue; }
        if (hatFeind(u.staat, nxt)){
          if (u.org < 1){ u.pfad = []; u.fort = 0; continue; }
          (kaempfe.get(nxt) || kaempfe.set(nxt, []).get(nxt)).push(u);
          u.kampf = true; continue;
        }
        this.erholen(u, 0.3); u.schanz = 0;
        const i = this.prov[u.prov].nb.indexOf(nxt);
        u.fort += 1;
        if (i < 0){ u.pfad = []; continue; }
        if (u.fort >= this.wegKosten(u, u.prov, i) * (this.feind(u.staat, this.kontrolle[nxt]) ? 2 : 1)){
          u.prov = nxt; u.pfad.shift(); u.fort = 0;
          if (this.feind(u.staat, this.kontrolle[nxt])) this.einnehmen(nxt, u.staat);
        }
      }
      for (const [p, angreifer] of kaempfe) this.kampf(p, angreifer);
      if (this.stunde % 6 === 0) this.ki();
      if (this.stunde % 24 === 0) this.pruefeKapitulation();
    }
    erholen(u, f){
      const t = TYPEN[u.typ];
      u.org = Math.min(t.org, u.org + 1.2 * f);
      if (f >= 1 && this.freund(this.kontrolle[u.prov], u.staat)) u.staerke = Math.min(1, u.staerke + 0.002);
    }
    einnehmen(p, tag){
      // Befreites eigenes/verbuendetes Kernland geht an den Besitzer zurueck
      this.kontrolle[p] = this.freund(this.besitz[p], tag) ? this.besitz[p] : tag;
      this.aenderung = true;
      const s = this.staaten[this.besitz[p]];
      if (p === s.hauptstadt && !this.freund(tag, this.besitz[p])) this.meldung(`${this.staaten[tag].n} erobert die Hauptstadt von ${s.n}.`, true);
    }
    kampf(p, alleAngreifer){
      const seite = alleAngreifer[0].staat;
      // Kampfbreite: nur die staerksten Angreifer kaempfen, der Rest wartet
      const angreifer = alleAngreifer.length <= KAMPFBREITE ? alleAngreifer
        : alleAngreifer.slice().sort((a, b) => this.kraft(b, 'angriff') - this.kraft(a, 'angriff')).slice(0, KAMPFBREITE);
      const verteidiger = this.einheiten.filter(v => v.prov === p && this.feind(seite, v.staat));
      if (!verteidiger.length) return;
      const summe = (l, w) => l.reduce((s, u) => s + this.kraft(u, w), 0);
      let A = summe(angreifer, 'angriff') * GELAENDE[this.prov[p].t].angriff;
      let V = verteidiger.reduce((s, v) => s + this.kraft(v, 'verteidigung') * (1 + 0.3 * v.schanz), 0);
      // Panzerung: wer mehr Panzerung hat als der Gegner Durchschlag, kaempft besser
      const mittel = (l, w) => l.reduce((s, u) => s + TYPEN[u.typ][w], 0) / l.length;
      let schadenAn = 1, schadenVe = 1;
      if (mittel(angreifer, 'panzerung') > mittel(verteidiger, 'durchschlag')){ A *= 1.2; schadenAn *= 0.6; }
      if (mittel(verteidiger, 'panzerung') > mittel(angreifer, 'durchschlag')){ V *= 1.2; schadenVe *= 0.6; }
      const r = A / Math.max(0.1, V);
      const z = () => 0.8 + this.rnd() * 0.4;
      for (const v of verteidiger){ v.org -= Math.min(8, 2.2 * r) * z() * schadenVe; v.staerke -= 0.004 * Math.min(4, r) * schadenVe; v.kampf = true; }
      for (const a of angreifer){ a.org -= Math.min(8, 2.2 / r) * z() * schadenAn; a.staerke -= 0.004 * Math.min(4, 1 / r) * schadenAn; }
      // Zerschlagene Verteidiger ziehen sich zurueck oder werden aufgerieben
      for (const v of verteidiger){
        if (v.staerke <= 0.05){ this.vernichten(v, 'aufgerieben'); continue; }
        if (v.org > 0) continue;
        const ziele = this.prov[p].nb.filter(n => this.freund(this.kontrolle[n], v.staat) && !this.einheiten.some(w => w.prov === n && this.feind(v.staat, w.staat)));
        if (!ziele.length){ this.vernichten(v, 'eingekesselt'); continue; }
        ziele.sort((x, y) => this.einheitenIn(y).filter(w => w.staat === v.staat).length - this.einheitenIn(x).filter(w => w.staat === v.staat).length);
        v.prov = ziele[0]; v.pfad = []; v.fort = 0; v.org = 0;
      }
      const abbruch = new Set();
      for (const a of angreifer){
        if (a.staerke <= 0.05) this.vernichten(a, 'aufgerieben');
        else if (a.org <= 0){ a.org = 0; a.pfad = []; a.fort = 0; abbruch.add(a.staat); }
      }
      for (const t of abbruch) if (t === this.spieler) this.meldung(`Angriff auf ${this.provName ? this.provName(p) : 'Provinz ' + p} abgebrochen: keine Organisation mehr.`);
    }
    vernichten(u, grund){
      this.einheiten = this.einheiten.filter(v => v !== u);
      if (u.staat === this.spieler) this.meldung(`Eine ${TYPEN[u.typ].n}division wurde ${grund}.`);
    }

    // ---------- Gegner-KI (nur fuer Staaten im Krieg) ----------
    ki(){
      const staaten = new Set();
      for (const k of this.kriege) for (const t of k.split('|')) if (t !== this.spieler || this.automatik) staaten.add(t);
      for (const tag of staaten) this.kiStaat(tag);
    }
    kiStaat(tag){
      const eigene = this.einheiten.filter(u => u.staat === tag);
      if (!eigene.length) return;
      const feindKraft = p => this.einheiten.reduce((s, v) => v.prov === p && this.feind(tag, v.staat) ? s + this.kraft(v, 'verteidigung') : s, 0);
      const istFront = p => this.freund(this.kontrolle[p], tag) && this.prov[p].nb.some(n => this.feind(tag, this.kontrolle[n]));
      // 1. Angriffe aus Frontprovinzen
      const nachProv = new Map();
      for (const u of eigene) if (!u.pfad.length && u.org > this.typ(u).org * 0.6) (nachProv.get(u.prov) || nachProv.set(u.prov, []).get(u.prov)).push(u);
      for (const [p, us] of nachProv){
        const ziele = this.prov[p].nb.filter(n => this.feind(tag, this.kontrolle[n]));
        if (!ziele.length) continue;
        let best = -1, bk = Infinity;
        for (const z of ziele){ const k = feindKraft(z); if (k < bk){ bk = k; best = z; } }
        const eigenA = us.reduce((s, u) => s + this.kraft(u, 'angriff'), 0);
        if (bk === 0 || eigenA * GELAENDE[this.prov[best].t].angriff / bk >= 1.6){
          const bleiben = us.length > 1 ? 1 : 0;
          us.slice(bleiben).forEach(u => { u.pfad = [best]; u.fort = 0; });
        }
      }
      // 2. Eine Division bleibt in der Hauptstadt, solange sie gehalten wird
      const hs = this.staaten[tag].hauptstadt;
      if (this.kontrolle[hs] === tag && eigene.length >= 4 && !eigene.some(u => u.prov === hs && !u.pfad.length)){
        const naechste = eigene.filter(u => !u.kampf).sort((a, b) => distKm(this.prov[a.prov].l, this.prov[hs].l) - distKm(this.prov[b.prov].l, this.prov[hs].l))[0];
        if (naechste){ const pfad = this.weg(naechste, hs); if (pfad){ naechste.pfad = pfad; naechste.fort = 0; naechste.wache = true; } }
      }
      // 3. Einheiten ohne Front ruecken an die Front
      const fronten = [];
      this.kontrolle.forEach((k, p) => { if (istFront(p)) fronten.push(p); });
      if (!fronten.length) return;
      // Zusammenhangskomponenten des begehbaren Gebiets (ohne Flotte kein Weg uebers Meer)
      const komp = new Int32Array(this.prov.length).fill(-1);
      let kn = 0;
      for (let s0 = 0; s0 < this.prov.length; s0++){
        if (komp[s0] >= 0 || !this.betretbar(tag, s0)) continue;
        const st = [s0]; komp[s0] = kn;
        while (st.length){ const p = st.pop(); for (const n of this.prov[p].nb) if (komp[n] < 0 && this.betretbar(tag, n)){ komp[n] = kn; st.push(n); } }
        kn++;
      }
      const besetzt = new Map(fronten.map(p => [p, eigene.filter(u => u.prov === p || u.pfad[u.pfad.length - 1] === p).length]));
      const bedrohung = new Map(fronten.map(p => [p, 1 + this.prov[p].nb.reduce((s, n) => s + this.einheiten.filter(v => v.prov === n && this.feind(tag, v.staat)).length, 0)]));
      for (const u of eigene){
        if (u.pfad.length || istFront(u.prov) || (u.wache && u.prov === hs)) continue;
        // naechste Frontprovinzen per Luftlinie, davon die am schwaechsten besetzte
        const kand = fronten.filter(p => komp[p] === komp[u.prov]).map(p => [p, distKm(this.prov[p].l, this.prov[u.prov].l)]).sort((a, b) => a[1] - b[1]).slice(0, 8);
        kand.sort((a, b) => besetzt.get(a[0]) / bedrohung.get(a[0]) - besetzt.get(b[0]) / bedrohung.get(b[0]));
        if (!kand.length) continue;
        const p = kand[0][0], pfad = this.weg(u, p);
        if (pfad && pfad.length){ u.pfad = pfad; u.fort = 0; besetzt.set(p, besetzt.get(p) + 1); }
      }
    }
  }

  const api = { Spiel, TYPEN, ARMEEN, GELAENDE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else global.EpochenLogik = api;
})(typeof window !== 'undefined' ? window : globalThis);
