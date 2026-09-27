'use strict';
// Epochen – Oberflaeche: Laden, Zeit, Info-Panel, Einheiten-Auswahl und Befehle, Kriegserklaerung, Meldungen.
(async function(){
  const $ = id => document.getElementById(id);
  const merken = (k, v) => { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const holen = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const { Spiel, TYPEN, GELAENDE } = window.EpochenLogik;

  let prov, welt;
  try {
    [prov, welt] = await Promise.all([
      fetch('/daten/provinzen.json').then(r => r.json()),
      fetch('/daten/epochen/1936/welt.json').then(r => r.json())
    ]);
  } catch (e){
    $('laden').textContent = 'Die Karte konnte nicht geladen werden. Bitte Seite neu laden.';
    return;
  }
  const karte = new EpochenKarte.Karte($('karte'), prov, welt);
  let spielerTag = holen('epochen.nation');
  if (spielerTag && !welt.staaten[spielerTag]) spielerTag = null;
  const spiel = new Spiel(prov.provinzen, welt, { spieler:spielerTag, seed:Date.now() % 100000 });
  karte.besitz = spiel.kontrolle; karte.baueGrenzen();
  spiel.provName = id => karte.prov[id].n;
  const ansicht = new EinheitenAnsicht(karte, spiel);
  $('laden').classList.add('weg');

  // ---------- Kartenstil & Hilfe ----------
  const stilKnoepfe = document.querySelectorAll('.umschalter button');
  function stil(name){
    karte.setzeStil(name);
    stilKnoepfe.forEach(b => b.classList.toggle('an', b.dataset.stil === name));
    merken('epochen.stil', name);
  }
  stilKnoepfe.forEach(b => b.addEventListener('click', () => stil(b.dataset.stil)));
  stil(holen('epochen.stil') === 'flach' ? 'flach' : 'generalstab');
  $('hilfeKnopf').addEventListener('click', () => { $('hilfe').hidden = false; });
  $('hilfeZu').addEventListener('click', () => { $('hilfe').hidden = true; merken('epochen.hilfe2', '1'); });
  $('hilfe').addEventListener('click', e => { if (e.target.id === 'hilfe') $('hilfe').hidden = true; });
  if (!holen('epochen.hilfe2')) $('hilfe').hidden = false;

  // ---------- Zeit ----------
  const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const STUNDEN_PRO_SEK = [0, 2, 6, 14, 30, 72];
  let laeuft = false, tempo = 3, rest = 0;
  const datumText = (d, uhr) => `${d.getUTCDate()}. ${MONATE[d.getUTCMonth()]} ${d.getUTCFullYear()}` + (uhr ? `, ${String(d.getUTCHours()).padStart(2, '0')}:00` : '');
  function zeigeDatum(){ $('datum').textContent = datumText(spiel.datum(), true); }
  function setzeLauf(an){ laeuft = an; $('pause').textContent = an ? '❚❚' : '▶'; $('pause').classList.toggle('laeuft', an); }
  function setzeTempo(t){ tempo = t; document.querySelectorAll('.tempo button').forEach(b => b.classList.toggle('an', +b.dataset.tempo === t)); }
  $('pause').addEventListener('click', () => setzeLauf(!laeuft));
  document.querySelectorAll('.tempo button').forEach(b => b.addEventListener('click', () => setzeTempo(+b.dataset.tempo)));
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (e.code === 'Space'){ e.preventDefault(); setzeLauf(!laeuft); }
    if (/^[1-5]$/.test(e.key)) setzeTempo(+e.key);
    if (e.key === 'Escape'){ abwaehlen(); $('panel').hidden = true; karte.auswahl = -1; karte.auswahlStaat = null; karte.schmutzig = true; }
  });
  zeigeDatum();
  let zuletzt = performance.now(), panelTakt = 0;
  function takt(jetzt){
    const dt = Math.min(0.25, (jetzt - zuletzt) / 1000); zuletzt = jetzt;
    if (laeuft){
      rest += dt * STUNDEN_PRO_SEK[tempo];
      let n = Math.min(120, Math.floor(rest)); rest -= n;
      if (n > 0){
        while (n--) spiel.schritt();
        if (spiel.aenderung){ spiel.aenderung = false; karte.baueGrenzen(); }
        zeigeDatum();
        karte.schmutzig = true;
        if (++panelTakt % 4 === 0) aktualisierePanels();
      }
    }
    requestAnimationFrame(takt);
  }
  requestAnimationFrame(takt);

  // ---------- Meldungen ----------
  function meldungZeigen(m){
    const el = document.createElement('div');
    if (m.wichtig) el.className = 'wichtig';
    const d = document.createElement('span'); d.className = 'klein'; d.textContent = datumText(new Date(spiel.start + m.stunde * 3600e3));
    el.append(d, m.text);
    $('meldungen').append(el);
    while ($('meldungen').children.length > 3) $('meldungen').firstChild.remove();
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 700); }, m.wichtig ? 14000 : 8000);
  }
  spiel.beiMeldung = m => {
    meldungZeigen(m);
    if (spielerTag && spiel.staaten[spielerTag].kapituliert && /kapituliert/.test(m.text) && m.text.startsWith(spiel.staaten[spielerTag].n)){
      setzeLauf(false);
    }
  };
  spiel.meldungen.forEach(meldungZeigen);

  // ---------- Tooltip ----------
  const tipp = $('tipp');
  karte.beiHover = (id, p) => {
    if (id < 0){ tipp.hidden = true; return; }
    const s = karte.staat(karte.besitz[id]);
    tipp.innerHTML = '';
    tipp.append(karte.prov[id].n, ' ');
    const k = document.createElement('span'); k.className = 'klein';
    k.textContent = '· ' + s.n + (karte.eigentuemer[id] !== karte.besitz[id] ? ' (besetzt)' : '') + ' · ' + GELAENDE[spiel.prov[id].t].n;
    tipp.append(k);
    tipp.hidden = false;
    const x = Math.min(innerWidth - tipp.offsetWidth - 8, p[0] + 14), y = Math.min(innerHeight - 40, p[1] + 16);
    tipp.style.left = x + 'px'; tipp.style.top = y + 'px';
  };

  // ---------- Spieler ----------
  $('automatik').addEventListener('change', e => { spiel.automatik = e.target.checked; });
  function zeigeSpieler(){
    $('autoWahl').hidden = !spielerTag;
    const el = $('spieler'); el.innerHTML = '';
    if (!spielerTag) return;
    const s = welt.staaten[spielerTag];
    const f = document.createElement('span'); f.className = 'flagge'; f.style.background = s.f;
    el.append('Du führst: ', f, s.n + (spiel.staaten[spielerTag].kapituliert ? ' (kapituliert)' : ''));
  }
  zeigeSpieler();
  function waehleNation(tag){
    spielerTag = tag; spiel.spieler = tag; merken('epochen.nation', tag);
    for (const u of spiel.einheiten) if (u.staat === tag){ u.wache = false; }
    abwaehlen(); zeigeSpieler();
  }

  // ---------- Provinz-Panel ----------
  const zahl = n => n.toLocaleString('de-DE');
  let panelProv = -1, kriegBestaetigen = false;
  function zeigeProvinz(id){
    panelProv = id; kriegBestaetigen = false;
    if (id < 0){ $('panel').hidden = true; karte.auswahlStaat = null; karte.schmutzig = true; return; }
    $('panel').hidden = false;
    aktualisiereProvinz();
  }
  function aktualisiereProvinz(){
    const id = panelProv; if (id < 0) return;
    const p = karte.prov[id], tag = karte.besitz[id], s = karte.staat(tag), eig = karte.eigentuemer[id];
    $('pName').textContent = p.n;
    const ober = s.oberherr && karte.staat(s.oberherr);
    $('pStaat').textContent = (eig !== tag ? `besetzt von ${s.n} · gehört ${karte.staat(eig).n}` : s.n + (ober ? ' · unter ' + ober.n : ''));
    $('pFarbe').style.background = s.f;
    $('pGelaende').textContent = GELAENDE[spiel.prov[id].t].n;
    $('pFlaeche').textContent = zahl(p.a) + ' km²';
    const hier = spiel.einheitenIn(id), proStaat = {};
    hier.forEach(u => proStaat[u.staat] = (proStaat[u.staat] || 0) + 1);
    $('pTruppen').textContent = Object.keys(proStaat).length ? Object.entries(proStaat).map(([t, n]) => `${n} ${karte.staat(t).n}`).join(', ') : 'keine';
    $('pNachbarn').textContent = p.nb.length;
    $('pAnzahl').textContent = karte.besitz.filter(t => t === tag).length;
    $('pHaupt').textContent = s.hn || karte.prov[s.hauptstadt].n;
    $('pSpielen').textContent = spielerTag === tag ? 'Deine Nation' : 'Als ' + s.n + ' spielen';
    $('pSpielen').onclick = () => { waehleNation(tag); aktualisiereProvinz(); };
    $('pHaupt2').onclick = () => karte.fliegeZu(s.hauptstadt, Math.max(karte.kamera.z, 14));
    // Krieg erklaeren
    const kb = $('pKrieg');
    const eigenLager = spielerTag && spiel.lager(spielerTag).has(tag);
    if (!spielerTag || tag === spielerTag || eigenLager || spiel.staaten[tag].kapituliert || spiel.staaten[spielerTag].kapituliert){ kb.hidden = true; }
    else if (spiel.feind(spielerTag, tag)){ kb.hidden = false; kb.textContent = 'Im Krieg'; kb.disabled = true; kb.classList.remove('sicher'); }
    else {
      kb.hidden = false; kb.disabled = false;
      kb.textContent = kriegBestaetigen ? `Wirklich Krieg gegen ${s.n}?` : 'Krieg erklären';
      kb.classList.toggle('sicher', kriegBestaetigen);
      kb.onclick = () => {
        if (!kriegBestaetigen){ kriegBestaetigen = true; aktualisiereProvinz(); return; }
        spiel.kriegErklaeren(spielerTag, tag); kriegBestaetigen = false; karte.schmutzig = true; aktualisiereProvinz();
      };
    }
    karte.auswahlStaat = tag; karte.schmutzig = true;
  }
  $('panelZu').addEventListener('click', () => { zeigeProvinz(-1); karte.auswahl = -1; });

  // ---------- Einheiten-Auswahl & Befehle ----------
  const beruehrung = matchMedia('(pointer: coarse)').matches;
  function abwaehlen(){ ansicht.auswahl.clear(); $('einheitPanel').hidden = true; karte.schmutzig = true; }
  function waehle(ids, dazu){
    if (!dazu) ansicht.auswahl.clear();
    ids.forEach(i => ansicht.auswahl.add(i));
    zeigeProvinz(-1);
    $('einheitPanel').hidden = !ansicht.auswahl.size;
    aktualisiereEinheiten(); karte.schmutzig = true;
  }
  function aktualisiereEinheiten(){
    const us = ansicht.ausgewaehlt();
    for (const id of [...ansicht.auswahl]) if (!us.some(u => u.id === id)) ansicht.auswahl.delete(id);
    if (!us.length){ $('einheitPanel').hidden = true; return; }
    const tag = us[0].staat, s = karte.staat(tag);
    const orte = new Set(us.map(u => u.prov));
    $('eStaat').textContent = s.n + (orte.size === 1 ? ' · in ' + karte.prov[us[0].prov].n : ` · in ${orte.size} Provinzen`);
    $('eTitel').textContent = us.length === 1 ? '1 Division' : us.length + ' Divisionen';
    const arten = {}; us.forEach(u => arten[u.typ] = (arten[u.typ] || 0) + 1);
    $('eArt').textContent = Object.entries(arten).map(([t, n]) => `${n} ${TYPEN[t].n}`).join(' · ');
    const org = us.reduce((a, u) => a + u.org / TYPEN[u.typ].org, 0) / us.length;
    const stk = us.reduce((a, u) => a + u.staerke, 0) / us.length;
    $('eOrg').style.width = Math.round(Math.max(0, org) * 100) + '%';
    $('eOrg').style.background = org > 0.5 ? '#4fc45a' : org > 0.2 ? '#e0b43a' : '#e0503a';
    $('eStaerke').style.width = Math.round(stk * 100) + '%';
    const kampf = us.filter(u => u.kampf).length, marsch = us.filter(u => u.pfad.length && !u.kampf);
    let status = 'Bereit';
    if (kampf) status = `${kampf} im Kampf um ${karte.prov[us.find(u => u.kampf).pfad[0]].n}`;
    else if (marsch.length){ const z = marsch[0].pfad[marsch[0].pfad.length - 1]; status = `Marschiert nach ${karte.prov[z].n}`; }
    $('eStatus').textContent = status;
    const eigene = tag === spielerTag;
    $('eHinweis').textContent = !eigene ? 'Fremde Truppen – nur ansehen.' : beruehrung ? 'Tippe auf das Ziel, um zu marschieren. × hebt die Auswahl auf.' : 'Rechtsklick auf das Ziel: Marschbefehl. Umschalt+Klick: weitere Truppen.';
    $('eHalt').hidden = !eigene; $('eAlle').hidden = !eigene;
  }
  $('ePanelZu').addEventListener('click', abwaehlen);
  $('eHalt').addEventListener('click', () => { spiel.anhalten([...ansicht.auswahl]); aktualisiereEinheiten(); karte.schmutzig = true; });
  $('eAlle').addEventListener('click', () => waehle(spiel.einheiten.filter(u => u.staat === spielerTag).map(u => u.id), false));
  function befehl(ziel){
    const us = ansicht.ausgewaehlt().filter(u => u.staat === spielerTag);
    if (ziel < 0 || !us.length) return false;
    const n = spiel.bewegen(us.map(u => u.id), ziel);
    if (!n) meldungZeigen({ stunde:spiel.stunde, text:`Kein Weg nach ${karte.prov[ziel].n} (neutrales Gebiet oder übers Meer).` });
    aktualisiereEinheiten(); karte.schmutzig = true;
    return true;
  }

  karte.beiKlick = (id, e, p) => {
    const st = ansicht.trefferAn(p);
    const eigeneAuswahl = ansicht.ausgewaehlt().some(u => u.staat === spielerTag);
    // Touch: mit eigener Auswahl ist jeder Tipp auf die Karte (auch auf andere Steine) ein Marschbefehl
    if (e.pointerType !== 'mouse' && eigeneAuswahl && (id >= 0 || st) && !(st && st.ids.every(i => ansicht.auswahl.has(i)))){
      befehl(st ? st.prov : id); return;
    }
    if (st){
      const dazu = e.shiftKey;
      const schonGewaehlt = !dazu && st.ids.every(i => ansicht.auswahl.has(i)) && ansicht.auswahl.size === st.ids.length;
      if (schonGewaehlt) abwaehlen(); else waehle(st.ids, dazu);
      return;
    }
    abwaehlen();
    zeigeProvinz(id);
  };
  karte.beiRechtsklick = id => { if (!befehl(id) && id >= 0) zeigeProvinz(id); };

  function aktualisierePanels(){
    if (!$('einheitPanel').hidden) aktualisiereEinheiten();
    if (!$('panel').hidden && !kriegBestaetigen) aktualisiereProvinz();
    zeigeSpieler();
  }

  // ---------- Start ----------
  if (spielerTag) karte.fliegeZu(welt.staaten[spielerTag].hauptstadt, 9);
  else { karte.kamera.x = 15; karte.kamera.y = EpochenKarte.projY(50); karte.kamera.z = Math.max(6, innerWidth / 70); karte.begrenzen(); }

  // Debug-Zugriff
  window.epochen = { karte, welt, prov, spiel, ansicht, sim:h => { for (let i = 0; i < h; i++) spiel.schritt(); if (spiel.aenderung){ spiel.aenderung = false; karte.baueGrenzen(); } zeigeDatum(); aktualisierePanels(); karte.schmutzig = true; } };
})();
