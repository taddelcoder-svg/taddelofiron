'use strict';
// Epochen – Wirtschafts-Oberflaeche: Ressourcenleiste, Fenster mit Produktion / Bau / Heer.
(function(){
  const L = window.EpochenLogik;
  const zahl = n => Math.round(n).toLocaleString('de-DE');
  const mio = n => n >= 1e6 ? (n / 1e6).toLocaleString('de-DE', { maximumFractionDigits:2 }) + ' Mio.' : zahl(n / 1000) + ' Tsd.';
  const el = (tag, attr = {}, ...kinder) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr)){
      if (k === 'onclick') e.onclick = v; else if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
    }
    for (const k of kinder) if (k !== null && k !== undefined) e.append(k);
    return e;
  };

  class WirtschaftUI {
    constructor(o){
      this.o = o; // { spiel(), spieler(), karte, provName, meldung }
      this.tab = 'produktion';
      this.fenster = document.getElementById('wirtschaft');
      this.leiste = document.getElementById('ressourcen');
      document.getElementById('wirtschaftKnopf').addEventListener('click', () => this.umschalten());
      document.getElementById('wZu').addEventListener('click', () => this.zeigen(false));
      this.fenster.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.aktualisieren(); }));
      addEventListener('keydown', e => {
        if (e.target.closest && e.target.closest('input,textarea')) return;
        if (e.key === 'p' || e.key === 'P'){ this.tab = 'produktion'; this.zeigen(true); }
        if (e.key === 'b' || e.key === 'B'){ this.tab = 'bau'; this.zeigen(true); }
        if (e.key === 'h' || e.key === 'H'){ this.tab = 'heer'; this.zeigen(true); }
      });
    }
    umschalten(){ this.zeigen(this.fenster.hidden); }
    zeigen(an){
      if (an && !this.o.spieler()){ this.o.meldung('Wähle zuerst eine Nation (Provinz antippen → „Als … spielen“).'); return; }
      this.fenster.hidden = !an; if (an) this.aktualisieren();
    }

    // ---------- Ressourcenleiste ----------
    leisteAktualisieren(){
      const tag = this.o.spieler(), sp = this.o.spiel();
      document.getElementById('wirtschaftKnopf').hidden = !tag;
      if (!tag || !sp.wi[tag]){ this.leiste.hidden = true; return; }
      const w = sp.wi[tag], b = w.bilanz || sp.kennzahlen(tag);
      this.leiste.hidden = false; this.leiste.innerHTML = '';
      const feld = (titel, wert, klasse) => this.leiste.append(el('span', { class:'feld' + (klasse ? ' ' + klasse : ''), title:titel }, el('b', { text:titel.split(' ')[0] }), ' ' + wert));
      feld('ZF zivile Fabriken (frei für Bau)', `${zahl(b.zf)} (${zahl(b.bauZf)})`);
      feld('MF Militärfabriken', zahl(b.mf));
      for (const [r, n] of Object.entries(L.ROHSTOFFE)){
        const saldo = Math.round(b.roh[r] + b.import[r] - b.bedarf[r]);
        feld(`${n} (Förderung + Import − Bedarf)`, `${zahl(b.roh[r])}${saldo < 0 ? ' ▼' + zahl(-saldo) : ''}`, saldo < 0 ? 'mangel' : b.import[r] > 0 ? 'import' : '');
      }
      feld('Mann Mannstärke verfügbar', mio(b.mann), b.mann < 30000 ? 'mangel' : '');
      feld('Ausr. Infanterieausrüstung im Lager', zahl(w.lager.ausruestung));
      feld('Pz Panzer im Lager', zahl(w.lager.panzer));
    }

    // ---------- Fenster ----------
    aktualisieren(){
      this.leisteAktualisieren();
      if (this.fenster.hidden) return;
      const tag = this.o.spieler(), sp = this.o.spiel();
      if (!tag){ this.fenster.hidden = true; return; }
      this.fenster.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('an', b.dataset.tab === this.tab));
      const inhalt = document.getElementById('wInhalt'); inhalt.innerHTML = '';
      const w = sp.wi[tag], k = sp.kennzahlen(tag);
      if (this.tab === 'produktion') this.produktion(inhalt, sp, tag, w, k);
      if (this.tab === 'bau') this.bau(inhalt, sp, tag, w, k);
      if (this.tab === 'heer') this.heer(inhalt, sp, tag, w, k);
    }
    produktion(box, sp, tag, w, k){
      box.append(el('p', { class:'klein', text:`${Math.floor(k.mf)} Militärfabriken, davon ${k.mfFrei} frei. Mehr Fabriken an einer Linie senken kurz deren Effizienz.` }));
      for (const [ware, def] of Object.entries(L.WAREN)){
        const l = w.linien.find(x => x.ware === ware) || { mf:0, eff:0 };
        let f = 1; for (const r in def.roh) f = Math.min(f, k.faktor[r]);
        const proTag = l.mf * 2.5 * l.eff * (0.5 + 0.5 * f) / def.pp;
        const setz = d => { sp.linieSetzen(tag, ware, l.mf + d); this.aktualisieren(); };
        box.append(el('div', { class:'linie' },
          el('div', {}, el('b', { text:def.n }), el('div', { class:'klein', text:`Effizienz ${Math.round(l.eff * 100)} % · ${proTag.toFixed(1)} pro Tag · Lager ${zahl(w.lager[ware])}` + (f < 1 ? ` · Rohstoffmangel −${Math.round((1 - f) * 50)} %` : '') })),
          el('div', { class:'zaehler' },
            el('button', { text:'−5', onclick:() => setz(-5) }), el('button', { text:'−', onclick:() => setz(-1) }),
            el('span', { text:String(l.mf) }),
            el('button', { text:'+', onclick:() => setz(1) }), el('button', { text:'+5', onclick:() => setz(5) }))));
      }
      const tab = el('table', { class:'roh' }, el('tr', {}, ...['', 'Förderung', 'Bedarf', 'Import', 'Deckung'].map(x => el('th', { text:x }))));
      for (const [r, n] of Object.entries(L.ROHSTOFFE)) tab.append(el('tr', {},
        el('td', { text:n }), el('td', { text:zahl(k.roh[r]) }), el('td', { text:zahl(k.bedarf[r]) }), el('td', { text:zahl(k.import[r]) }),
        el('td', { class:k.faktor[r] < 1 ? 'mangel' : '', text:Math.round(k.faktor[r] * 100) + ' %' })));
      box.append(el('h3', { text:'Rohstoffe' }), tab);
      const hk = el('input', { type:'checkbox' }); hk.checked = w.handel; hk.onchange = () => { w.handel = hk.checked; this.aktualisieren(); };
      box.append(el('label', { class:'haken' }, hk, ` Fehlende Rohstoffe automatisch einkaufen (bindet ${k.handelZf} zivile Fabriken)`));
    }
    bau(box, sp, tag, w, k){
      box.append(el('p', { class:'klein', text:`${zahl(k.zf)} zivile Fabriken: ${k.kg} für Konsumgüter, ${k.handelZf} für Handel, ${k.bauZf} bauen (höchstens 15 je Projekt).` }));
      const schnell = el('div', { class:'knoepfe' });
      for (const art of ['zf', 'mf']){
        schnell.append(el('button', { text:`${L.BAUTEN[art].n} bauen`, onclick:() => {
          const orte = [];
          for (let p = 0; p < sp.prov.length; p++) if (!sp.kannBauen(tag, art, p)) orte.push(p);
          orte.sort((a, b) => (sp.infra[b] * 10 + sp.zf[b] + sp.mf[b]) - (sp.infra[a] * 10 + sp.zf[a] + sp.mf[a]));
          if (!orte.length){ this.o.meldung('Kein Bauplatz frei – erst Infrastruktur ausbauen.'); return; }
          sp.bauen(tag, art, orte[0]); this.aktualisieren();
        } }));
      }
      box.append(schnell, el('p', { class:'klein', text:'Oder eine eigene Provinz anklicken und dort gezielt bauen (auch Festung und Infrastruktur).' }));
      if (!w.bau.length) box.append(el('p', { text:'Keine Bauprojekte.' }));
      let zf = k.bauZf;
      w.bau.forEach((b, i) => {
        const einsatz = Math.min(15, Math.max(0, zf)); zf -= einsatz;
        const kosten = L.BAUTEN[b.art].kosten, proTag = einsatz * 5 * (0.8 + 0.1 * sp.infra[b.prov]);
        const tage = proTag > 0 ? Math.ceil((kosten - b.fort) / proTag) : null;
        box.append(el('div', { class:'projekt' },
          el('div', {}, el('b', { text:L.BAUTEN[b.art].n }), ' · ' + this.o.provName(b.prov),
            el('div', { class:'fort' }, el('i', { style:`width:${Math.round(b.fort / kosten * 100)}%` })),
            el('div', { class:'klein', text:tage ? `${einsatz} ZF · noch ${tage} Tage` : 'wartet auf freie Fabriken' })),
          el('button', { class:'klein-knopf', text:'✕', 'aria-label':'Entfernen', onclick:() => { sp.bauEntfernen(tag, i); this.aktualisieren(); } })));
      });
    }
    heer(box, sp, tag, w, k){
      const anz = sp.einheiten.filter(u => u.staat === tag).length;
      box.append(el('p', { text:`${anz} Divisionen im Feld, ${w.ausbildung.length} in Ausbildung (${L.AUSBILDUNG_TAGE} Tage).` }));
      const knoepfe = el('div', { class:'aushebung' });
      for (const [typ, kost] of Object.entries(L.AUSHEBUNG)){
        const grund = sp.kannAusheben(tag, typ);
        const teile = [`${zahl(kost.ausruestung)} Ausr.`]; if (kost.panzer) teile.push(`${kost.panzer} Pz`); teile.push(`${zahl(kost.mann)} Mann`);
        knoepfe.append(el('button', { class:grund ? 'aus' : 'haupt', title:grund || '', onclick:() => {
          if (grund){ this.o.meldung(grund + '.'); return; }
          sp.ausheben(tag, typ); this.aktualisieren();
        } }, el('b', { text:L.TYPEN[typ].n }), el('span', { class:'klein', text:teile.join(' · ') }), grund ? el('span', { class:'klein', text:grund }) : null));
      }
      box.append(knoepfe);
      if (w.ausbildung.length){
        const l = el('ul', { class:'liste' });
        w.ausbildung.forEach(a => l.append(el('li', { text:`${L.TYPEN[a.typ].n} – noch ${a.tage} Tage` })));
        box.append(el('h3', { text:'In Ausbildung' }), l);
      }
      box.append(el('h3', { text:'Wehrgesetz' }), el('p', { class:'klein', text:`Mannstärke: ${mio(k.mann)} frei von ${mio(k.mannMax)}. Mobilmachung bindet 10 % der zivilen Fabriken.` }));
      const wg = el('div', { class:'segment' });
      for (let i = 1; i <= 3; i++){
        const g = L.WEHRGESETZ[i];
        wg.append(el('button', { class:w.wehrgesetz === i ? 'an' : '', onclick:() => { sp.setzeWehrgesetz(tag, i); this.aktualisieren(); } },
          el('b', { text:g.n }), el('span', { class:'klein', text:` ${(g.rate * 100).toLocaleString('de-DE')} %` })));
      }
      box.append(wg);
    }
  }
  window.WirtschaftUI = WirtschaftUI;
})();
