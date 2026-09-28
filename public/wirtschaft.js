'use strict';
// Epochen – Wirtschaft (Erweiterung von Spiel in logik.js): Fabriken, Bauschlange, Rohstoffe mit
// automatischem Handel, Produktionslinien, Lager, Mannstaerke/Wehrgesetz, Ausbildung, Verstaerkung,
// dazu die Wirtschafts-KI. Taeglich abgerechnet, deterministisch, speicherbar.
(function(global){
  const L = typeof module !== 'undefined' && module.exports ? require('./logik.js') : global.EpochenLogik;
  const { Spiel, TYPEN } = L;

  const PP_JE_MF = 2.5;             // Produktionspunkte je Militaerfabrik und Tag bei 100 % Effizienz
  const BP_JE_ZF = 5;               // Baupunkte je ziviler Fabrik und Tag
  const ZF_JE_PROJEKT = 15;
  const WAREN = {
    ausruestung:{ n:'Infanterieausrüstung', kurz:'Ausrüstung', pp:0.5, roh:{ stahl:0.5 } },
    panzer:{ n:'Panzer', kurz:'Panzer', pp:8, roh:{ stahl:1, oel:0.5, gummi:0.3 } },
    artillerie:{ n:'Artillerie', kurz:'Artillerie', pp:3.5, roh:{ stahl:1 } },
    flugzeuge:{ n:'Flugzeuge', kurz:'Flugzeuge', pp:1.5, roh:{ oel:0.3, stahl:0.3 } },
    schiff_zr:{ n:'Zerstörer', kurz:'Zerstörer', pp:400, roh:{ stahl:1 }, schiff:'zr' },
    schiff_ub:{ n:'U-Boote', kurz:'U-Boote', pp:300, roh:{ stahl:1 }, schiff:'ub' },
    schiff_kr:{ n:'Kreuzer', kurz:'Kreuzer', pp:1200, roh:{ stahl:1.5 }, schiff:'kr' },
    schiff_sl:{ n:'Schlachtschiffe', kurz:'Schlachtschiffe', pp:5000, roh:{ stahl:2 }, schiff:'sl' },
    schiff_tr:{ n:'Flugzeugträger', kurz:'Träger', pp:5000, roh:{ stahl:1.5, oel:0.5 }, schiff:'tr' }
  };
  const ROHSTOFFE = { stahl:'Stahl', oel:'Öl', gummi:'Gummi' };
  const BAUTEN = {
    zf:{ n:'Zivile Fabrik', kosten:10800 },
    mf:{ n:'Militärfabrik', kosten:7200 },
    festung:{ n:'Festung', kosten:2500, max:5 },
    infra:{ n:'Infrastruktur', kosten:3000, max:5 }
  };
  // Kosten einer neuen Division
  const AUSHEBUNG = {
    inf:{ ausruestung:1000, panzer:0, artillerie:0, mann:10000 },
    kav:{ ausruestung:900, panzer:0, artillerie:0, mann:8000 },
    pz:{ ausruestung:400, panzer:150, artillerie:0, mann:8000 },
    art:{ ausruestung:1000, panzer:0, artillerie:40, mann:11000 }
  };
  const AUSBILDUNG_TAGE = 30;
  const WEHRGESETZ = [null, { n:'Freiwillige', rate:0.01, kg:0 }, { n:'Wehrpflicht', rate:0.025, kg:0 }, { n:'Mobilmachung', rate:0.05, kg:0.1 }];
  const HANDEL_JE_ZF = 8;           // importierte Rohstoffe je gebundener ziviler Fabrik

  Object.assign(Spiel.prototype, {
    // ---------- Aufbau ----------
    wirtschaftStart(welt){
      const w = welt.wirtschaft;
      this.zf = Float32Array.from(w.zf); this.mf = Float32Array.from(w.mf);
      this.infra = Int8Array.from(w.infra); this.bev = Int32Array.from(w.bev);
      this.roh = { stahl:Int16Array.from(w.stahl), oel:Int16Array.from(w.oel), gummi:Int16Array.from(w.gummi) };
      this.festungStart = w.festung;
      this.wi = {};
      for (const tag in this.staaten){
        this.wi[tag] = {
          lager:{ ausruestung:0, panzer:0, artillerie:0 }, linien:[], bau:[], ausbildung:[],
          wehrgesetz:(welt.staaten[tag] && welt.staaten[tag].wehrgesetz) || 1, eingezogen:0,
          bilanz:null, handel:true, ziel:0
        };
      }
    },
    wirtschaftNachAufstellung(){
      this.festung = Int8Array.from(this.festungStart);
      for (const u of this.einheiten) this.wi[u.staat].eingezogen += AUSHEBUNG[u.typ].mann;
      for (const tag in this.wi){
        const w = this.wi[tag], anz = this.einheiten.filter(u => u.staat === tag).length;
        w.ziel = Math.round(anz * 1.4) + 2;
        // Startlager: 10 Tage Nachschub, Startlinien 80 % Ausruestung / 20 % Panzer (wenn Panzer vorhanden)
        w.lager.ausruestung = 600 + anz * 150;
        w.lager.panzer = this.einheiten.some(u => u.staat === tag && u.typ === 'pz') ? 100 : 0;
        this.kiLinien(tag);
      }
    },
    wirtschaftStand(){
      return {
        zf:Array.from(this.zf), mf:Array.from(this.mf), infra:Array.from(this.infra),
        wi:JSON.parse(JSON.stringify(this.wi))
      };
    },
    ladeWirtschaft(d){
      this.zf = Float32Array.from(d.zf); this.mf = Float32Array.from(d.mf); this.infra = Int8Array.from(d.infra);
      this.wi = d.wi;
      for (const t in this.wi) if (this.wi[t].lager.artillerie === undefined) this.wi[t].lager.artillerie = 0;
    },

    // ---------- Kennzahlen ----------
    fabrikAnteil(p, tag){ // eigenes Kernland zaehlt voll, besetztes halb
      if (this.kontrolle[p] !== tag) return 0;
      return this.besitz[p] === tag ? 1 : 0.5;
    },
    kennzahlen(tag){
      const w = this.wi[tag], k = { zf:0, mf:0, roh:{ stahl:0, oel:0, gummi:0 }, bev:0 };
      for (let p = 0; p < this.prov.length; p++){
        const a = this.fabrikAnteil(p, tag); if (!a) continue;
        k.zf += this.zf[p] * a; k.mf += this.mf[p] * a;
        for (const r in k.roh) k.roh[r] += this.roh[r][p] * a;
        if (this.besitz[p] === tag) k.bev += this.bev[p] * 1000;
      }
      const krieg = this.imKrieg(tag);
      k.kg = Math.round(k.zf * ((krieg ? 0.1 : 0.2) + WEHRGESETZ[w.wehrgesetz].kg));
      k.mannMax = Math.round(k.bev * WEHRGESETZ[w.wehrgesetz].rate);
      k.mann = Math.max(0, k.mannMax - w.eingezogen);
      // Rohstoffbedarf der Produktionslinien
      k.bedarf = { stahl:0, oel:0, gummi:0 };
      for (const l of w.linien) for (const [r, m] of Object.entries(WAREN[l.ware].roh)) k.bedarf[r] += m * l.mf;
      // Automatischer Handel deckt Fehlmengen, kostet zivile Fabriken
      k.import = { stahl:0, oel:0, gummi:0 };
      let freiZf = Math.max(0, k.zf - k.kg);
      k.handelZf = 0;
      if (w.handel) for (const r in k.bedarf){
        const fehlt = Math.max(0, k.bedarf[r] - k.roh[r]);
        const zf = Math.min(freiZf, Math.ceil(fehlt / HANDEL_JE_ZF));
        k.import[r] = Math.min(fehlt, zf * HANDEL_JE_ZF) * (1 - ((this.konvoiVerlust && this.konvoiVerlust[tag]) || 0)); freiZf -= zf; k.handelZf += zf;
      }
      k.bauZf = Math.max(0, Math.floor(freiZf));
      k.mfFrei = Math.max(0, Math.floor(k.mf) - w.linien.reduce((s, l) => s + l.mf, 0));
      k.faktor = {};
      for (const r in k.bedarf) k.faktor[r] = k.bedarf[r] > 0 ? Math.min(1, (k.roh[r] + k.import[r]) / k.bedarf[r]) : 1;
      return k;
    },

    // ---------- Taeglicher Ablauf ----------
    wirtschaftTag(){
      const tagDesMonats = this.datum().getUTCDate();
      for (const tag in this.staaten){
        const s = this.staaten[tag], w = this.wi[tag];
        if (s.kapituliert) continue;
        const k = this.kennzahlen(tag);
        // Linien duerfen nicht mehr MF haben als vorhanden (nach Verlusten)
        let zuviel = w.linien.reduce((a, l) => a + l.mf, 0) - Math.floor(k.mf);
        for (let i = w.linien.length - 1; i >= 0 && zuviel > 0; i--){ const x = Math.min(zuviel, w.linien[i].mf); w.linien[i].mf -= x; zuviel -= x; }
        // Produktion
        for (const l of w.linien){
          if (l.mf <= 0) continue;
          const ware = WAREN[l.ware];
          let f = 1; for (const r in ware.roh) f = Math.min(f, k.faktor[r]);
          const menge = l.mf * PP_JE_MF * l.eff * (0.5 + 0.5 * f) / ware.pp;
          l.rest = (l.rest || 0) + menge;
          const ganz = Math.floor(l.rest); l.rest -= ganz;
          if (ware.schiff){ if (ganz > 0 && this.schiffFertig) this.schiffFertig(tag, ware.schiff, ganz); }
          else w.lager[l.ware] = (w.lager[l.ware] || 0) + ganz;
          l.eff = Math.min(1, l.eff + 0.004);
        }
        // Bau
        let zf = k.bauZf;
        for (const b of w.bau){
          if (zf <= 0) break;
          const einsatz = Math.min(ZF_JE_PROJEKT, zf); zf -= einsatz;
          if (this.kontrolle[b.prov] !== tag){ b.fort = b.fort || 0; continue; }
          b.fort += einsatz * BP_JE_ZF * (0.8 + 0.1 * this.infra[b.prov]);
        }
        for (const b of w.bau.filter(b => b.fort >= BAUTEN[b.art].kosten)){
          if (b.art === 'zf') this.zf[b.prov]++;
          else if (b.art === 'mf') this.mf[b.prov]++;
          else if (b.art === 'festung') this.festung[b.prov] = Math.min(5, this.festung[b.prov] + 1);
          else if (b.art === 'infra') this.infra[b.prov] = Math.min(5, this.infra[b.prov] + 1);
          if (tag === this.spieler) this.meldung(`${BAUTEN[b.art].n} in ${this.provName ? this.provName(b.prov) : b.prov} fertig.`);
          if (b.art === 'mf') { const l = w.linien[0]; if (l && tag !== this.spieler) l.mf++; }
        }
        w.bau = w.bau.filter(b => b.fort < BAUTEN[b.art].kosten);
        // Ausbildung
        for (const a of w.ausbildung) a.tage--;
        for (const a of w.ausbildung.filter(a => a.tage <= 0)){
          const ort = this.sammelplatz(tag);
          if (ort < 0) continue;
          const u = this.neueEinheit(tag, a.typ, ort); u.org = TYPEN[a.typ].org * 0.5;
          if (tag === this.spieler) this.meldung(`Neue ${TYPEN[a.typ].n}division steht in ${this.provName ? this.provName(ort) : ort} bereit.`);
        }
        w.ausbildung = w.ausbildung.filter(a => a.tage > 0);
        // Verstaerkung aus dem Lager
        this.verstaerken(tag, w, k);
        w.bilanz = { zf:Math.round(k.zf), mf:Math.round(k.mf), kg:k.kg, handelZf:k.handelZf, bauZf:k.bauZf, mann:k.mann, mannMax:k.mannMax,
          roh:k.roh, bedarf:k.bedarf, import:k.import, faktor:k.faktor, mfFrei:k.mfFrei };
        // KI plant einmal im Monat (Spieler nur mit Automatik)
        if (tagDesMonats === 1 && (tag !== this.spieler || this.automatik)) this.kiWirtschaft(tag, k);
      }
    },
    sammelplatz(tag){
      const hs = this.staaten[tag].hauptstadt;
      if (this.kontrolle[hs] === tag) return hs;
      const eigen = this.kontrolle.findIndex((k, i) => k === tag && this.besitz[i] === tag);
      return eigen >= 0 ? eigen : this.kontrolle.indexOf(tag);
    },
    verstaerken(tag, w, k){
      let mann = k.mann;
      for (const u of this.einheiten){
        if (u.staat !== tag || u.staerke >= 1 || u.kampf || u.aufSee || !this.freund(this.kontrolle[u.prov], tag)) continue;
        const kost = AUSHEBUNG[u.typ];
        let d = Math.min(0.05, 1 - u.staerke);
        if (kost.ausruestung) d = Math.min(d, w.lager.ausruestung / kost.ausruestung);
        if (kost.panzer) d = Math.min(d, w.lager.panzer / kost.panzer);
        if (kost.artillerie) d = Math.min(d, (w.lager.artillerie || 0) / kost.artillerie);
        if (u.abgeschnitten) continue;
        d = Math.min(d, mann / kost.mann);
        if (d <= 0.0005) continue;
        u.staerke += d;
        w.lager.ausruestung -= Math.ceil(d * kost.ausruestung);
        w.lager.panzer -= Math.ceil(d * kost.panzer);
        if (kost.artillerie) w.lager.artillerie -= Math.ceil(d * kost.artillerie);
        const m = Math.round(d * kost.mann); w.eingezogen += m; mann -= m;
      }
      w.lager.ausruestung = Math.max(0, w.lager.ausruestung); w.lager.panzer = Math.max(0, w.lager.panzer);
    },
    verlust(u){ /* Gefallene bleiben eingezogen – Mannstaerke ist verbraucht */ },

    // ---------- Befehle ----------
    kannAusheben(tag, typ){
      const w = this.wi[tag], kost = AUSHEBUNG[typ], k = this.kennzahlen(tag);
      if (w.lager.ausruestung < kost.ausruestung) return 'Zu wenig Ausrüstung';
      if (w.lager.panzer < kost.panzer) return 'Zu wenige Panzer';
      if ((w.lager.artillerie || 0) < kost.artillerie) return 'Zu wenig Artillerie';
      if (k.mann < kost.mann) return 'Zu wenig Mannstärke';
      if (this.sammelplatz(tag) < 0) return 'Kein Sammelplatz';
      return null;
    },
    ausheben(tag, typ){
      if (this.kannAusheben(tag, typ)) return false;
      const w = this.wi[tag], kost = AUSHEBUNG[typ];
      w.lager.ausruestung -= kost.ausruestung; w.lager.panzer -= kost.panzer; w.lager.artillerie = (w.lager.artillerie || 0) - kost.artillerie; w.eingezogen += kost.mann;
      w.ausbildung.push({ typ, tage:AUSBILDUNG_TAGE });
      return true;
    },
    kannBauen(tag, art, p){
      if (this.besitz[p] !== tag || this.kontrolle[p] !== tag) return 'Nur im eigenen Kernland';
      const b = BAUTEN[art], geplant = this.wi[tag].bau.filter(x => x.prov === p && x.art === art).length;
      if (b.max && (art === 'festung' ? this.festung[p] : this.infra[p]) + geplant >= b.max) return 'Höchststufe erreicht';
      if ((art === 'zf' || art === 'mf') && this.zf[p] + this.mf[p] + this.wi[tag].bau.filter(x => x.prov === p && (x.art === 'zf' || x.art === 'mf')).length >= this.fabrikPlaetze(p)) return 'Kein Platz mehr (Infrastruktur ausbauen)';
      return null;
    },
    fabrikPlaetze(p){ return 2 + this.infra[p] * 3; },
    bauen(tag, art, p){
      if (this.kannBauen(tag, art, p)) return false;
      this.wi[tag].bau.push({ art, prov:p, fort:0 }); return true;
    },
    bauEntfernen(tag, i){ this.wi[tag].bau.splice(i, 1); },
    linieSetzen(tag, ware, mf){
      const w = this.wi[tag], k = this.kennzahlen(tag);
      let l = w.linien.find(x => x.ware === ware);
      const andere = w.linien.reduce((s, x) => s + (x === l ? 0 : x.mf), 0);
      mf = Math.max(0, Math.min(Math.floor(k.mf) - andere, mf));
      if (!l){ if (!mf) return; l = { ware, mf:0, eff:0.3, rest:0 }; w.linien.push(l); }
      if (mf > l.mf) l.eff = Math.max(0.3, l.eff * l.mf / mf); // neue Fabriken senken die Effizienz
      l.mf = mf;
    },
    setzeWehrgesetz(tag, stufe){ if (WEHRGESETZ[stufe]) this.wi[tag].wehrgesetz = stufe; },

    // ---------- KI ----------
    kiLinien(tag){
      const w = this.wi[tag], k = this.kennzahlen(tag), mf = Math.floor(k.mf);
      const pz = (this.einheiten.some(u => u.staat === tag && u.typ === 'pz') || mf >= 10) && k.roh.oel + mf >= 8;
      const nPz = pz ? Math.round(mf * 0.2) : 0, nArt = mf >= 8 ? Math.round(mf * 0.15) : 0;
      w.linien = [];
      if (mf - nPz - nArt > 0) w.linien.push({ ware:'ausruestung', mf:mf - nPz - nArt, eff:0.5, rest:0 });
      if (nPz > 0) w.linien.push({ ware:'panzer', mf:nPz, eff:0.5, rest:0 });
      if (nArt > 0) w.linien.push({ ware:'artillerie', mf:nArt, eff:0.5, rest:0 });
      // Luftwaffe und Werften fuer groessere Staaten
      const erste = w.linien[0];
      if (erste && mf >= 10){ const n = Math.round(mf * 0.1); erste.mf -= n; w.linien.push({ ware:'flugzeuge', mf:n, eff:0.5, rest:0 }); }
      if (erste && mf >= 10 && this.flotten && this.flotten.some(f => f.staat === tag)){ const n = Math.max(1, Math.round(mf * 0.08)); erste.mf -= n; w.linien.push({ ware:tag === 'GER' ? 'schiff_ub' : 'schiff_zr', mf:n, eff:0.5, rest:0 }); }
    },
    kiWirtschaft(tag, k){
      const w = this.wi[tag], krieg = this.imKrieg(tag);
      // freie Militaerfabriken den Linien zuteilen
      if (k.mfFrei > 0){ if (!w.linien.length) this.kiLinien(tag); else w.linien[0].mf += k.mfFrei; }
      // bauen: im Frieden zivil bis zum Verhaeltnis 1,5 : 1, sonst militaerisch
      if (w.bau.length < 2 && k.bauZf >= 3){
        const art = !krieg && k.zf < k.mf * 1.5 + 10 ? 'zf' : 'mf';
        const orte = [];
        for (let p = 0; p < this.prov.length; p++) if (!this.kannBauen(tag, art, p)) orte.push(p);
        orte.sort((a, b) => (this.infra[b] * 10 + this.zf[b] + this.mf[b]) - (this.infra[a] * 10 + this.zf[a] + this.mf[a]));
        if (orte.length) this.bauen(tag, art, orte[0]);
        else { // kein Platz: Infrastruktur im staerksten Industriegebiet
          const p = this.kontrolle.map((t, i) => t === tag && this.besitz[i] === tag ? i : -1).filter(i => i >= 0 && !this.kannBauen(tag, 'infra', i))
            .sort((a, b) => (this.zf[b] + this.mf[b]) - (this.zf[a] + this.mf[a]))[0];
          if (p !== undefined) this.bauen(tag, 'infra', p);
        }
      }
      // Mobilmachung im Krieg
      if (krieg && w.wehrgesetz < 3 && k.mann < 50000) this.setzeWehrgesetz(tag, w.wehrgesetz + 1);
      // Divisionen ausheben (im Frieden bis zum Ziel, im Krieg solange Material da ist)
      const anz = this.einheiten.filter(u => u.staat === tag).length + w.ausbildung.length;
      for (let n = 0; n < 6; n++){
        if (!krieg && anz + n >= w.ziel) break;
        // Reserve fuer Verstaerkungen behalten
        if (w.lager.ausruestung < 1500) break;
        const r = this.rnd();
        const typ = !this.kannAusheben(tag, 'pz') && r < 0.3 ? 'pz' : !this.kannAusheben(tag, 'art') && r < 0.7 ? 'art' : 'inf';
        if (!this.ausheben(tag, typ)) break;
      }
    }
  });

  Object.assign(L, { WAREN, ROHSTOFFE, BAUTEN, AUSHEBUNG, WEHRGESETZ, AUSBILDUNG_TAGE });
})(typeof window !== 'undefined' ? window : globalThis);
