'use strict';
// Epochen – Seefahrt und Luftwaffe (Erweiterung von Spiel): Seezonen, Flotten, Seeschlachten,
// Seeueberlegenheit, Konvoikrieg, Truppentransporte und Invasionen, Luftwaffe als Staerke-Pool.
(function(global){
  const L = typeof module !== 'undefined' && module.exports ? require('./logik.js') : global.EpochenLogik;
  const { Spiel, TYPEN, distKm } = L;

  const SCHIFFE = {
    sl:{ n:'Schlachtschiff', kurz:'SL', feuer:10, hp:10, jagd:0.5, konvoi:1, pp:5000 },
    tr:{ n:'Flugzeugträger', kurz:'TR', feuer:9, hp:8, jagd:2, konvoi:2, pp:5000 },
    kr:{ n:'Kreuzer', kurz:'KR', feuer:4, hp:4, jagd:1, konvoi:2, pp:1200 },
    zr:{ n:'Zerstörer', kurz:'ZR', feuer:1.5, hp:1.5, jagd:3, konvoi:1, pp:400 },
    ub:{ n:'U-Boot', kurz:'UB', feuer:1.5, hp:1, jagd:0, konvoi:4, pp:300 }
  };
  const FLOTTE_KMH = 28, TRANSPORT_KMH = 18;
  const AUFTRAEGE = { patrouille:'Patrouille (Seeüberlegenheit)', konvoi:'Konvois jagen', hafen:'Im Hafen (Reparatur)' };
  // Flotten 1936: [Staat, Name, lon, lat, {Schiffe}] (gerundet, grob nach Hearts of Iron)
  const FLOTTEN_1936 = [
    ['ENG', 'Home Fleet', 2, 57, { sl:9, tr:3, kr:25, zr:60 }], ['ENG', 'Mittelmeerflotte', 15, 35.5, { sl:5, tr:2, kr:15, zr:40 }],
    ['ENG', 'Ostasienflotte', 105, 3, { kr:6, zr:10 }], ['ENG', 'U-Boote', -5, 49, { ub:30 }],
    ['USA', 'Pazifikflotte', -157, 20, { sl:11, tr:3, kr:20, zr:70 }], ['USA', 'Atlantikflotte', -72, 37, { sl:4, tr:1, kr:10, zr:50 }],
    ['USA', 'U-Boote', -118, 32, { ub:60 }],
    ['JAP', 'Vereinigte Flotte', 135, 32, { sl:9, tr:4, kr:30, zr:90 }], ['JAP', 'U-Boote', 140, 33, { ub:50 }],
    ['FRA', 'Atlantikflotte', -6, 47.5, { sl:3, kr:8, zr:30 }], ['FRA', 'Mittelmeerflotte', 6, 42.5, { sl:4, tr:1, kr:10, zr:30 }],
    ['FRA', 'U-Boote', 5, 41, { ub:70 }],
    ['ITA', 'Flotte', 12, 39.5, { sl:4, kr:20, zr:60 }], ['ITA', 'U-Boote', 17, 38, { ub:60 }],
    ['GER', 'Flotte', 14, 54.8, { sl:3, kr:6, zr:12 }], ['GER', 'U-Boote', 6, 55.5, { ub:18 }],
    ['SOV', 'Ostseeflotte', 22, 58.5, { sl:2, kr:2, zr:12 }], ['SOV', 'Schwarzmeerflotte', 33, 43.5, { sl:1, kr:3, zr:8 }],
    ['SOV', 'U-Boote', 21, 58, { ub:50 }],
    ['SPA', 'Flotte', -1, 37.5, { kr:6, zr:15, ub:10 }], ['HOL', 'Ostindienflotte', 107, -5.5, { kr:4, zr:8, ub:12 }],
    ['SWE', 'Flotte', 18, 57.5, { kr:2, zr:10, ub:10 }], ['TUR', 'Flotte', 26, 40.5, { sl:1, zr:6 }], ['GRE', 'Flotte', 24, 37.5, { zr:10 }],
    ['ARG', 'Flotte', -57, -38, { sl:2, kr:3, zr:8 }], ['BRA', 'Flotte', -42, -24, { sl:2, zr:8 }], ['CHL', 'Flotte', -73, -34, { sl:1, kr:2, zr:6 }],
    ['POL', 'Flotte', 19, 55, { zr:4, ub:5 }], ['NOR', 'Flotte', 4, 60, { zr:6 }], ['AST', 'Flotte', 152, -34, { kr:4, zr:5 }],
    ['CAN', 'Flotte', -63, 44, { zr:6 }], ['CHI', 'Flotte', 122.5, 30.5, { kr:2, zr:4 }], ['YUG', 'Flotte', 16, 43, { zr:4, ub:4 }]
  ];
  const FLUGZEUGE_1936 = { FIN:120, GER:600, ENG:900, FRA:1000, SOV:1500, ITA:700, JAP:800, USA:700, POL:200, CZE:150, CHI:100, SPA:100, ROM:80, TUR:60 };

  const staerkeFlotte = (f, wert = 'feuer') => Object.entries(f.schiffe).reduce((s, [t, n]) => s + SCHIFFE[t][wert] * n, 0);
  const schiffAnzahl = f => Object.values(f.schiffe).reduce((s, n) => s + n, 0);

  Object.assign(Spiel.prototype, {
    // ---------- Aufbau ----------
    seeStart(meer){
      this.see = meer;
      this.zonenKm = meer.zonen.map(z => z.nb.map(n => Math.max(60, distKm(z.l, meer.zonen[n].l))));
      this.flotten = []; this.naechsteFlotte = 1;
    },
    seeNachAufstellung(){
      for (const [tag, name, lon, lat, schiffe] of FLOTTEN_1936){
        if (!this.staaten[tag]) continue;
        this.neueFlotte(tag, name, this.zoneNahe([lon, lat]), { ...schiffe });
      }
      for (const tag in this.wi){ this.wi[tag].lager.flugzeuge = FLUGZEUGE_1936[tag] || 0; this.wi[tag].luftEinsatz = 'luft'; }
    },
    zoneNahe(ll){
      let best = 0, bd = Infinity;
      this.see.zonen.forEach((z, i) => { if (!z.nb.length) return; const d = distKm(ll, z.l); if (d < bd){ bd = d; best = i; } });
      return best;
    },
    neueFlotte(tag, name, zone, schiffe){
      const f = { id:this.naechsteFlotte++, staat:tag, name, zone, pfad:[], fort:0, schiffe, schaden:0, auftrag:'patrouille', heimat:zone };
      for (const t in SCHIFFE) f.schiffe[t] = f.schiffe[t] || 0;
      this.flotten.push(f); return f;
    },
    seeStand(){ return { flotten:JSON.parse(JSON.stringify(this.flotten || [])), naechsteFlotte:this.naechsteFlotte || 1 }; },
    ladeSee(d){ this.flotten = d.flotten || []; this.naechsteFlotte = d.naechsteFlotte || 1; },

    // ---------- Haefen und Seewege ----------
    istHafen(p, tag){ return this.prov[p].k && this.see.provSee[p].length > 0 && this.freund(this.kontrolle[p], tag); },
    heimatZone(tag){ // Seezone am wichtigsten eigenen Hafen
      let best = -1, bw = -1;
      for (let p = 0; p < this.prov.length; p++){
        if (this.kontrolle[p] !== tag || this.besitz[p] !== tag || !this.see.provSee[p].length) continue;
        const w = this.infra[p] * 10 + this.zf[p] + this.mf[p]; if (w > bw){ bw = w; best = p; }
      }
      return best < 0 ? -1 : this.see.provSee[best][0];
    },
    zonenWeg(von, zielSet){ // Dijkstra ueber Seezonen -> { zonen, km }
      const n = this.see.zonen.length, d = new Float64Array(n).fill(Infinity), vor = new Int32Array(n).fill(-1), heap = new L.Heap();
      d[von] = 0; heap.push(von, 0);
      let ziel = -1;
      while (heap.size){
        const [z, dz] = heap.pop(); if (dz > d[z]) continue;
        if (zielSet.has(z)){ ziel = z; break; }
        this.see.zonen[z].nb.forEach((q, i) => { const nd = dz + this.zonenKm[z][i]; if (nd < d[q]){ d[q] = nd; vor[q] = z; heap.push(q, nd); } });
      }
      if (ziel < 0) return null;
      const zonen = []; for (let z = ziel; z !== -1; z = vor[z]) zonen.unshift(z);
      return { zonen, km:d[ziel] };
    },
    // Seeueberlegenheit eines Staats in einer Zone (0..1); Patrouillen strahlen halb in Nachbarzonen
    seeMacht(tag, zone){
      let eigen = 0, feind = 0;
      const zaehle = (f, g) => { if (f.auftrag === 'hafen') g *= 0.3; const s = staerkeFlotte(f) * g; if (this.freund(f.staat, tag)) eigen += s; else if (this.feind(tag, f.staat)) feind += s; };
      for (const f of this.flotten){
        if (f.zone === zone) zaehle(f, 1);
        else if (f.auftrag === 'patrouille' && this.see.zonen[zone].nb.includes(f.zone)) zaehle(f, 0.5);
      }
      return { eigen, feind, anteil:eigen + feind > 0 ? eigen / (eigen + feind) : (feind > 0 ? 0 : 1) };
    },

    // ---------- Truppentransport / Invasion ----------
    seeTransport(ids, ziel){
      const tag = this.spieler, erg = { ok:0, grund:null, tage:0, invasion:false };
      if (!this.prov[ziel].k || !this.see.provSee[ziel].length){ erg.grund = 'Das Ziel liegt nicht an der Küste.'; return erg; }
      const zielZonen = new Set(this.see.provSee[ziel]);
      const feindlich = this.feind(tag, this.kontrolle[ziel]);
      if (!feindlich && !this.freund(this.kontrolle[ziel], tag)){ erg.grund = 'Neutrales Gebiet kann man nicht betreten.'; return erg; }
      for (const u of this.einheiten){
        if (!ids.includes(u.id) || u.aufSee) continue;
        const plan = this.seePlan(u, ziel, zielZonen);
        if (!plan){ erg.grund = erg.grund || 'Kein Hafen erreichbar oder kein Seeweg.'; continue; }
        if (feindlich){
          const m = this.seeMacht(u.staat, plan.zonen[plan.zonen.length - 1]);
          if (m.anteil < 0.5){ erg.grund = `Für eine Invasion fehlt die Seeüberlegenheit (${Math.round(m.anteil * 100)} %, nötig 50 %).`; continue; }
        }
        u.pfad = plan.landweg; u.fort = 0; u.manuell = true;
        u.plan = { hafen:plan.hafen, ziel, zonen:plan.zonen, dauer:Math.ceil(plan.km / TRANSPORT_KMH) + (feindlich ? 48 : 0), invasion:feindlich };
        erg.ok++; erg.tage = Math.max(erg.tage, Math.ceil((plan.landStunden + u.plan.dauer) / 24)); erg.invasion = feindlich;
      }
      return erg;
    },
    seePlan(u, ziel, zielZonen){
      // Kandidaten: erreichbare eigene Haefen (Luftlinie nach Naehe zum Ziel, die besten 6 per Wegsuche pruefen)
      const kand = [];
      for (let p = 0; p < this.prov.length; p++) if (this.istHafen(p, u.staat) && !this.feind(u.staat, this.kontrolle[p])) kand.push(p);
      kand.sort((a, b) => distKm(this.prov[a].l, this.prov[u.prov].l) + distKm(this.prov[a].l, this.prov[ziel].l) * 0.5
        - distKm(this.prov[b].l, this.prov[u.prov].l) - distKm(this.prov[b].l, this.prov[ziel].l) * 0.5);
      let best = null;
      for (const h of kand.slice(0, 6)){
        const landweg = h === u.prov ? [] : this.weg(u, h);
        if (!landweg) continue;
        let landStunden = 0, von = u.prov;
        for (const q of landweg){ landStunden += this.wegKosten(u, von, this.prov[von].nb.indexOf(q)); von = q; }
        for (const z0 of this.see.provSee[h]){
          const w = this.zonenWeg(z0, zielZonen); if (!w) continue;
          const kosten = landStunden + w.km / TRANSPORT_KMH;
          if (!best || kosten < best.kosten) best = { hafen:h, landweg, landStunden, zonen:w.zonen, km:w.km, kosten };
        }
      }
      return best;
    },
    // stuendlich: Einschiffen, Fahrt, Landung
    seeSchritt(kaempfe){
      for (const u of this.einheiten){
        if (u.plan && !u.pfad.length && u.prov === u.plan.hafen && !u.aufSee){
          // Gefahr unterwegs: feindliche Seeueberlegenheit auf der Route kostet Staerke
          let gefahr = 0;
          for (const z of u.plan.zonen) gefahr = Math.max(gefahr, 1 - this.seeMacht(u.staat, z).anteil);
          u.aufSee = { ...u.plan, fort:0, von:u.prov, gefahr }; u.plan = null; u.schanz = 0;
        }
        if (!u.aufSee) continue;
        const s = u.aufSee; s.fort++;
        if (s.fort < s.dauer) continue;
        const ziel = s.ziel;
        if (s.gefahr > 0.5 && !s.verlustBerechnet){
          s.verlustBerechnet = true;
          u.staerke -= 0.3 * (s.gefahr - 0.5) * 2;
          if (u.staerke <= 0.05){ this.vernichten(u, 'auf See versenkt'); continue; }
          if (u.staat === this.spieler) this.meldung('Ein Truppentransport wurde auf See angegriffen.');
        }
        const feinde = this.einheiten.some(v => v.prov === ziel && !v.aufSee && this.feind(u.staat, v.staat));
        if (!this.betretbar(u.staat, ziel)){ this.landen(u, s.von); continue; }
        if (feinde){
          if (u.org < 1){ // Landung gescheitert
            u.staerke -= 0.1; this.landen(u, s.von);
            if (u.staat === this.spieler) this.meldung(`Landung in ${this.provName ? this.provName(ziel) : ziel} gescheitert.`);
            continue;
          }
          (kaempfe.get(ziel) || kaempfe.set(ziel, []).get(ziel)).push(u); u.kampf = true; u.landung = true;
          continue;
        }
        this.landen(u, ziel);
        if (this.feind(u.staat, this.kontrolle[ziel])) this.einnehmen(ziel, u.staat);
      }
    },
    landen(u, p){ u.prov = p; u.aufSee = null; u.landung = false; u.pfad = []; u.fort = 0; },

    // ---------- Flotten ----------
    flotteBewegen(id, zone){
      const f = this.flotten.find(x => x.id === id); if (!f) return false;
      if (zone === f.zone){ f.pfad = []; return true; }
      const w = this.zonenWeg(f.zone, new Set([zone])); if (!w) return false;
      f.pfad = w.zonen.slice(1); f.fort = 0; return true;
    },
    flotteAuftrag(id, auftrag){ const f = this.flotten.find(x => x.id === id); if (f && AUFTRAEGE[auftrag]) f.auftrag = auftrag; },
    flotteSchritt(){
      for (const f of this.flotten){
        if (!f.pfad.length) continue;
        const nxt = f.pfad[0], i = this.see.zonen[f.zone].nb.indexOf(nxt);
        if (i < 0){ f.pfad = []; continue; }
        f.fort++;
        if (f.fort >= this.zonenKm[f.zone][i] / FLOTTE_KMH){ f.zone = nxt; f.pfad.shift(); f.fort = 0; }
      }
      // Seeschlachten: Zonen mit Flotten verfeindeter Staaten
      const proZone = new Map();
      for (const f of this.flotten) (proZone.get(f.zone) || proZone.set(f.zone, []).get(f.zone)).push(f);
      for (const [zone, fs] of proZone){
        if (fs.length < 2) continue;
        const a = fs[0].staat, feinde = fs.filter(f => this.feind(a, f.staat));
        if (!feinde.length) continue;
        const freunde = fs.filter(f => !this.feind(a, f.staat) && this.freund(a, f.staat));
        this.seeschlacht(zone, freunde, feinde);
      }
      this.flotten = this.flotten.filter(f => schiffAnzahl(f) > 0);
    },
    seeschlacht(zone, A, B){
      const feuer = l => l.reduce((s, f) => s + staerkeFlotte(f, 'feuer') * (f.schiffe.ub === schiffAnzahl(f) ? 0.5 : 1), 0);
      const jagd = l => l.reduce((s, f) => s + staerkeFlotte(f, 'jagd'), 0);
      const fa = feuer(A), fb = feuer(B), ja = jagd(A), jb = jagd(B);
      const treffen = (ziel, f, j) => {
        for (const x of ziel){
          const oberflaeche = schiffAnzahl(x) - x.schiffe.ub;
          const anteil = schiffAnzahl(x) ? 1 / ziel.length : 0;
          x.schaden += (oberflaeche > 0 ? f * 0.03 : 0) * anteil * (0.7 + 0.6 * this.rnd()) + j * 0.02 * (x.schiffe.ub > 0 ? 1 : 0) * anteil;
          this.versenken(x);
        }
      };
      treffen(B, fa, ja); treffen(A, fb, jb);
      // Rueckzug der deutlich schwaecheren Seite in den Heimathafen
      const na = feuer(A), nb = feuer(B);
      const rueckzug = l => l.forEach(f => { f.auftrag = 'hafen'; const h = this.heimatZone(f.staat); if (h >= 0) this.flotteBewegen(f.id, h); });
      if (na < nb * 0.3) rueckzug(A); else if (nb < na * 0.3) rueckzug(B);
      if (A.concat(B).some(f => f.staat === this.spieler) && !this._seeMeldung || (this._seeMeldung && this._seeMeldung !== zone)){
        if (A.concat(B).some(f => f.staat === this.spieler)){ this._seeMeldung = zone; this.meldung(`Seeschlacht bei ${this.see.zonen[zone].n}!`, true); }
      }
    },
    versenken(f){
      while (f.schaden > 0){
        const typen = Object.keys(f.schiffe).filter(t => f.schiffe[t] > 0);
        if (!typen.length) return;
        // kleine Schiffe werden haeufiger getroffen
        const gew = typen.map(t => f.schiffe[t] / Math.sqrt(SCHIFFE[t].hp)), s = gew.reduce((a, b) => a + b, 0);
        let r = this.rnd() * s, t = typen[0];
        for (let i = 0; i < typen.length; i++){ r -= gew[i]; if (r <= 0){ t = typen[i]; break; } }
        if (f.schaden < SCHIFFE[t].hp) return;
        f.schaden -= SCHIFFE[t].hp; f.schiffe[t]--;
        if (f.staat === this.spieler && SCHIFFE[t].hp >= 4) this.meldung(`${SCHIFFE[t].n} der ${f.name} versenkt.`);
      }
    },
    schiffFertig(tag, typ, n){
      let f = this.flotten.filter(x => x.staat === tag && (typ === 'ub') === (x.schiffe.ub === schiffAnzahl(x))).sort((a, b) => schiffAnzahl(b) - schiffAnzahl(a))[0];
      if (!f){ const z = this.heimatZone(tag); if (z < 0) return; f = this.neueFlotte(tag, typ === 'ub' ? 'U-Boote' : 'Flotte', z, {}); }
      f.schiffe[typ] += n;
      if (tag === this.spieler) this.meldung(`${n} ${SCHIFFE[typ].n} fertig – zur ${f.name}.`);
    },

    // ---------- Taeglich: Reparatur, Konvoikrieg, Luftwaffe, See-KI ----------
    seeTag(){
      // Reparatur im Hafen (Zone an eigener Kueste)
      for (const f of this.flotten){
        if (f.auftrag === 'hafen' && !f.pfad.length && this.see.zonen[f.zone].kp.some(p => this.kontrolle[p] === f.staat)) f.schaden = Math.max(0, f.schaden - 3);
      }
      // Konvoikrieg: feindliche Jaeger in Zonen an der eigenen Kueste senken Importe
      this.konvoiVerlust = {};
      const jaeger = this.flotten.filter(f => f.auftrag === 'konvoi' && !f.pfad.length);
      if (jaeger.length) for (const tag in this.staaten){
        if (!this.imKrieg(tag)) continue;
        const zonen = new Set();
        for (let p = 0; p < this.prov.length; p++) if (this.besitz[p] === tag && this.kontrolle[p] === tag) this.see.provSee[p].forEach(z => zonen.add(z));
        let raub = 0, schutz = 0;
        for (const f of this.flotten){
          if (!zonen.has(f.zone)) continue;
          if (f.auftrag === 'konvoi' && this.feind(tag, f.staat)) raub += staerkeFlotte(f, 'konvoi');
          else if (this.freund(tag, f.staat) && f.auftrag === 'patrouille') schutz += staerkeFlotte(f, 'jagd');
        }
        if (!raub) continue;
        const v = Math.max(0, Math.min(0.6, (raub - 0.5 * schutz) / (raub + 40)));
        this.konvoiVerlust[tag] = v;
        // Geleitschutz versenkt U-Boote
        if (schutz > 0) for (const f of jaeger) if (zonen.has(f.zone) && this.feind(tag, f.staat)){ f.schaden += schutz * 0.004; this.versenken(f); }
        if (tag === this.spieler && v > 0.1 && this.datum().getUTCDate() % 7 === 1) this.meldung(`Konvoikrieg: ${Math.round(v * 100)} % der Importe gehen verloren.`);
      }
      this.flotten = this.flotten.filter(f => schiffAnzahl(f) > 0);
      // Luftwaffe: Verluste im Krieg
      for (const tag in this.wi){
        const w = this.wi[tag]; if (!w.lager.flugzeuge) continue;
        if (this.imKrieg(tag)) w.lager.flugzeuge = Math.floor(w.lager.flugzeuge * 0.997);
      }
      this.seeKi();
    },
    luftFaktor(angreifer, verteidiger){ // Luftueberlegenheit und Bodenunterstuetzung im Kampf
      const la = this.wi[angreifer] ? this.wi[angreifer].lager.flugzeuge || 0 : 0, lv = this.wi[verteidiger] ? this.wi[verteidiger].lager.flugzeuge || 0 : 0;
      if (!la && !lv) return { a:1, v:1 };
      const luft = (t, n) => n * (this.wi[t].luftEinsatz === 'boden' ? 0.5 : 1), boden = (t, n) => n * (this.wi[t].luftEinsatz === 'boden' ? 1 : 0.3);
      const ua = luft(angreifer, la), uv = verteidiger && this.wi[verteidiger] ? luft(verteidiger, lv) : 0;
      const anteil = ua + uv > 0 ? ua / (ua + uv) : 0.5;
      const cas = x => Math.min(0.2, x / 4000);
      return { a:1 + 0.25 * (anteil - 0.5) * 2 + cas(boden(angreifer, la)) * anteil, v:1 + 0.15 * (0.5 - anteil) * 2 };
    },
    seeKi(){
      for (const f of this.flotten){
        if (f.staat === this.spieler || f.pfad.length) continue;
        const tag = f.staat, nurUb = f.schiffe.ub === schiffAnzahl(f);
        if (!this.imKrieg(tag)){ if (f.auftrag !== 'patrouille' && !f.schaden) f.auftrag = 'patrouille'; continue; }
        if (f.schaden > staerkeFlotte(f, 'hp') * 0.3){ f.auftrag = 'hafen'; const h = this.heimatZone(tag); if (h >= 0 && h !== f.zone) this.flotteBewegen(f.id, h); continue; }
        if (nurUb){
          // U-Boote jagen Konvois an der Kueste des naechsten Gegners
          const gegner = this.gegner(tag)[0]; if (!gegner) continue;
          const zonen = new Set();
          for (let p = 0; p < this.prov.length; p++) if (this.besitz[p] === gegner && this.kontrolle[p] === gegner) this.see.provSee[p].forEach(z => zonen.add(z));
          if (!zonen.size) continue;
          f.auftrag = 'konvoi';
          if (!zonen.has(f.zone)){ const w = this.zonenWeg(f.zone, zonen); if (w && w.zonen.length > 1) f.pfad = w.zonen.slice(1); }
        } else {
          // Uebermacht in der Naehe: in den Heimathafen ausweichen
          const m = this.seeMacht(tag, f.zone);
          let feindNah = m.feind; for (const n of this.see.zonen[f.zone].nb) feindNah = Math.max(feindNah, this.seeMacht(tag, n).feind);
          if (feindNah > staerkeFlotte(f) * 1.5){ f.auftrag = 'hafen'; const h = this.heimatZone(tag); if (h >= 0 && h !== f.zone) this.flotteBewegen(f.id, h); }
          else f.auftrag = 'patrouille';
        }
      }
    },
    // KI-Invasion: Staaten im Krieg ohne Landfront landen an der schwaechsten feindlichen Kueste
    kiInvasion(tag){
      if (tag === this.spieler || !this.flotten.some(f => f.staat === tag)) return;
      const gegner = this.gegner(tag); if (!gegner.length) return;
      const landfront = this.kontrolle.some((k, p) => this.freund(k, tag) && this.prov[p].nb.some(n => this.feind(tag, this.kontrolle[n])));
      if (landfront) return;
      const frei = this.einheiten.filter(u => u.staat === tag && !u.pfad.length && !u.aufSee && !u.plan && u.org > TYPEN[u.typ].org * 0.8);
      if (frei.length < 6) return;
      let best = -1, bw = Infinity;
      for (let p = 0; p < this.prov.length; p++){
        if (!gegner.includes(this.kontrolle[p]) || !this.prov[p].k || !this.see.provSee[p].length) continue;
        const def = this.einheiten.filter(v => v.prov === p && this.feind(tag, v.staat)).length;
        const m = this.see.provSee[p].reduce((s, z) => Math.max(s, this.seeMacht(tag, z).anteil), 0);
        if (m < 0.5) continue;
        const w = def * 3 + distKm(this.prov[p].l, this.prov[this.staaten[tag].hauptstadt].l) / 1500;
        if (w < bw){ bw = w; best = p; }
      }
      if (best < 0) return;
      const trupp = frei.slice(0, Math.min(12, Math.ceil(frei.length / 3)));
      const alt = this.spieler; this.spieler = tag; // seeTransport nutzt den Befehlsgeber
      this.seeTransport(trupp.map(u => u.id), best);
      this.spieler = alt;
    }
  });

  Object.assign(L, { SCHIFFE, AUFTRAEGE, staerkeFlotte, schiffAnzahl });
})(typeof window !== 'undefined' ? window : globalThis);
