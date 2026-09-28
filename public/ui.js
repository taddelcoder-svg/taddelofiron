'use strict';
// Epochen – Oberflaeche: Laden, Zeit, Info-Panel, Einheiten-Auswahl und Befehle, Kriegserklaerung, Meldungen.
(async function(){
  const $ = id => document.getElementById(id);
  const merken = (k, v) => { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const holen = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const { Spiel, TYPEN, GELAENDE, ROHSTOFFE } = window.EpochenLogik;
  const Speicher = window.EpochenSpeicher;

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
  $('laden').classList.add('weg');

  // ---------- Spielstand waehlen: Laden-Auftrag, Fortsetzen oder neu ----------
  const MONATE_K = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const datumKurz = d => `${d.getUTCDate()}. ${MONATE_K[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  function dialog(titel, bauen){ // bauen(inhalt, schliessen) – gibt ein Versprechen zurueck
    return new Promise(ok => {
      $('menueTitel').textContent = titel; const box = $('menueInhalt'); box.innerHTML = '';
      const zu = wert => { $('menue').hidden = true; ok(wert); };
      $('menueZu').onclick = () => zu(null);
      bauen(box, zu); $('menue').hidden = false;
    });
  }
  function knopf(text, klasse, fn){ const b = document.createElement('button'); b.textContent = text; if (klasse) b.className = klasse; b.onclick = fn; return b; }
  let stand = null;
  const auftrag = holen('epochen.laden'); merken('epochen.laden');
  if (auftrag){ const e = await Speicher.holen(auftrag); if (e) stand = e.stand; }
  else {
    const auto = await Speicher.holen('auto');
    if (auto){
      const wahl = await dialog('Willkommen zurück', (box, zu) => {
        const p = document.createElement('p');
        p.textContent = `Letzter Stand: ${auto.meta.datumText}${auto.meta.staat ? ' · ' + auto.meta.staat : ''}.`;
        const k = document.createElement('div'); k.className = 'knoepfe';
        k.append(knopf('Fortsetzen', 'haupt', () => zu('weiter')), knopf('Neues Spiel', '', () => zu('neu')));
        box.append(p, k);
      });
      if (wahl !== 'neu') stand = auto.stand;
    }
  }
  let spiel;
  try { spiel = new Spiel(prov.provinzen, welt, stand ? { stand } : { spieler:spielerTag, seed:Date.now() % 100000 }); }
  catch (e){ spiel = new Spiel(prov.provinzen, welt, { spieler:spielerTag, seed:Date.now() % 100000 }); stand = null; }
  if (stand){ spielerTag = spiel.spieler; $('automatik').checked = !!spiel.automatik; }
  karte.besitz = spiel.kontrolle; karte.eigentuemer = spiel.besitz; karte.baueGrenzen();
  spiel.provName = id => karte.prov[id].n;
  const ansicht = new EinheitenAnsicht(karte, spiel);

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
  function zeigeDatum(){ $('datum').textContent = datumText(spiel.datum(), innerWidth > 700); }
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
  let letzterMonat = spiel.datum().getUTCMonth();
  function eintrag(){
    const s = spielerTag && welt.staaten[spielerTag];
    return { meta:{ datumText:datumKurz(spiel.datum()), stunde:spiel.stunde, spieler:spielerTag, staat:s ? s.n : null, gespeichert:Date.now() }, stand:spiel.stand() };
  }
  let autosaveAn = true;
  const autosave = () => { if (autosaveAn) Speicher.schreiben('auto', eintrag()); };
  addEventListener('pagehide', autosave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) autosave(); });
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
        const m = spiel.datum().getUTCMonth();
        if (m !== letzterMonat){ letzterMonat = m; autosave(); }
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
    const w = spiel.wetter(id);
    k.textContent = '· ' + s.n + (karte.eigentuemer[id] !== karte.besitz[id] ? ' (besetzt)' : '') + ' · ' + GELAENDE[spiel.prov[id].t].n + (w === 'winter' ? ' · Winter' : w === 'schlamm' ? ' · Schlamm' : '');
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
    const d = document.createElement('span'); d.className = 'dufuehrst'; d.textContent = 'Du führst:';
    el.append(d, f, s.n + (spiel.staaten[spielerTag].kapituliert ? ' (kapituliert)' : ''));
  }
  zeigeSpieler();
  function waehleNation(tag){
    spielerTag = tag; spiel.spieler = tag; merken('epochen.nation', tag);
    wui.aktualisieren();
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
    const bevT = spiel.bev[id];
    $('pBev').textContent = bevT >= 1000 ? (bevT / 1000).toLocaleString('de-DE', { maximumFractionDigits:1 }) + ' Mio.' : zahl(bevT) + ' Tsd.';
    $('pFabriken').textContent = `${spiel.zf[id]} zivil · ${spiel.mf[id]} militär (Plätze ${spiel.fabrikPlaetze(id)})`;
    $('pInfra').textContent = `${spiel.infra[id]} · ${spiel.festung[id]}`;
    const roh = Object.entries(ROHSTOFFE).filter(([r]) => spiel.roh[r][id]).map(([r, n]) => `${spiel.roh[r][id]} ${n}`);
    $('pRoh').textContent = roh.length ? roh.join(', ') : '–';
    const eigen = spielerTag && eig === spielerTag && tag === spielerTag;
    $('pBauen').hidden = !eigen;
    if (eigen) document.querySelectorAll('#pBauen [data-bau]').forEach(b => {
      const grund = spiel.kannBauen(spielerTag, b.dataset.bau, id);
      b.title = grund || ''; b.classList.toggle('aus', !!grund);
      b.onclick = () => {
        if (grund){ meldungZeigen({ stunde:spiel.stunde, text:grund + '.' }); return; }
        spiel.bauen(spielerTag, b.dataset.bau, id);
        meldungZeigen({ stunde:spiel.stunde, text:`Bauauftrag: ${b.textContent} in ${p.n}.` });
        wui.aktualisieren(); aktualisiereProvinz();
      };
    });
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
    // Versorgung
    const kessel = us.filter(x => x.abgeschnitten >= 1), vmin = Math.min(...us.map(x => x.vers === undefined ? 1 : x.vers));
    $('eVersorgung').textContent = kessel.length ? `⚠ ${kessel.length} eingekesselt seit ${Math.max(...kessel.map(x => x.abgeschnitten))} Tagen – ab 3 Tagen Verluste`
      : `Versorgung ${Math.round(vmin * 100)} %${us.some(x => x.ueberlast) ? ' · überlastet (zu viele Divisionen in einer Provinz)' : ''}${spiel.wetter(us[0].prov) === 'winter' ? ' · Winter' : spiel.wetter(us[0].prov) === 'schlamm' ? ' · Schlamm' : ''}`;
    $('eVersorgung').classList.toggle('mangel', kessel.length > 0);
    // Armee
    const armeeIds = new Set(us.map(x => x.armee || 0));
    const armee = armeeIds.size === 1 && us[0].armee ? spiel.armeeMit(us[0].armee) : null;
    ansicht.gewaehlteArmee = armee ? armee.id : null;
    $('eArmee').hidden = !armee || !eigene;
    $('eArmeeBilden').hidden = !eigene || !!armee;
    $('aAufloesen').hidden = !eigene || !armee;
    if (armee){
      const g = armee.general, e = EpochenLogik.EIGENSCHAFTEN[g.eigenschaft];
      $('aName').textContent = armee.name + ' · ' + spiel.armeeEinheiten(armee).length + ' Divisionen';
      $('aGeneral').textContent = `General ${g.name} · ${'★'.repeat(g.fertigkeit)}${'☆'.repeat(4 - g.fertigkeit)} · ${e.n} (${e.text})`;
      $('aAuto').checked = !!armee.automatik;
      $('aLoeschen').hidden = !armee.front;
      $('aPfeil').hidden = !armee.front;
    }
    $('eHinweis').textContent = !eigene ? 'Fremde Truppen – nur ansehen.' : beruehrung ? 'Tippe auf das Ziel, um zu marschieren. × hebt die Auswahl auf.' : 'Rechtsklick auf das Ziel: Marschbefehl. Umschalt+Klick: weitere Truppen.';
    $('eHalt').hidden = !eigene; $('eAlle').hidden = !eigene;
  }
  $('ePanelZu').addEventListener('click', abwaehlen);
  // ---------- Armeen, Fronten, Pfeile ----------
  const gewaehlteArmee = () => ansicht.gewaehlteArmee ? spiel.armeeMit(ansicht.gewaehlteArmee) : null;
  $('eArmeeBilden').addEventListener('click', () => {
    const us = ansicht.ausgewaehlt().filter(x => x.staat === spielerTag);
    const a = spiel.armeeBilden(spielerTag, us.map(x => x.id));
    if (!a) return;
    meldungZeigen({ stunde:spiel.stunde, text:`${a.name} gebildet unter General ${a.general.name}. Jetzt eine Front ziehen.` + (us.length > 24 ? ' (höchstens 24 Divisionen je Armee)' : '') });
    waehle(spiel.armeeEinheiten(a).map(x => x.id), false);
  });
  $('aAufloesen').addEventListener('click', () => { const a = gewaehlteArmee(); if (a){ spiel.armeeAufloesen(a.id); aktualisiereEinheiten(); karte.schmutzig = true; } });
  $('aLoeschen').addEventListener('click', () => { const a = gewaehlteArmee(); if (a){ spiel.frontLoeschen(a.id); aktualisiereEinheiten(); karte.schmutzig = true; } });
  $('aAuto').addEventListener('change', e => { const a = gewaehlteArmee(); if (a) a.automatik = e.target.checked; });
  function zeichnen(art){
    const a = gewaehlteArmee(); if (!a) return;
    const hinweis = art === 'front' ? 'Zieh eine Linie entlang der Grenze, die die Armee halten soll.' : 'Zieh einen Pfeil von der Front ins Feindesland – die Armee greift entlang an.';
    $('zeichenHinweis').textContent = hinweis + (beruehrung ? '' : ' Esc bricht ab.'); $('zeichenHinweis').hidden = false;
    $('karte').classList.add('zeichnen');
    const fertig = () => { $('zeichenHinweis').hidden = true; $('karte').classList.remove('zeichnen'); };
    karte.zeichenModus = { farbe:art === 'front' ? '#3fb24f' : '#d9432f', beiAbbruch:fertig, beiFertig:punkte => {
      fertig();
      if (art === 'front'){
        const ok = spiel.frontSetzen(a.id, punkte);
        meldungZeigen({ stunde:spiel.stunde, text:ok ? `${a.name}: Front mit ${spiel.frontProvinzen(a).length} Provinzen.` : 'Keine eigene Grenzprovinz in der Nähe der Linie.' });
      } else {
        if (punkte.length < 2){ meldungZeigen({ stunde:spiel.stunde, text:'Der Pfeil ist zu kurz.' }); return; }
        spiel.pfeilSetzen(a.id, punkte);
        meldungZeigen({ stunde:spiel.stunde, text:`${a.name}: Angriff befohlen.` + (spiel.imKrieg(spielerTag) ? '' : ' (Greift erst an, wenn Krieg herrscht.)') });
      }
      aktualisiereEinheiten(); karte.schmutzig = true;
    } };
  }
  $('aFront').addEventListener('click', () => zeichnen('front'));
  $('aPfeil').addEventListener('click', () => zeichnen('pfeil'));
  addEventListener('keydown', e => { if (e.key === 'Escape' && karte.zeichenModus){ const m = karte.zeichenModus; karte.zeichenModus = null; karte.strich = null; m.beiAbbruch(); karte.schmutzig = true; } });
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
    wui.aktualisieren();
    if (!$('einheitPanel').hidden) aktualisiereEinheiten();
    if (!$('panel').hidden && !kriegBestaetigen) aktualisiereProvinz();
    zeigeSpieler();
  }

  // ---------- Wirtschaft ----------
  const wui = new WirtschaftUI({ spiel:() => spiel, spieler:() => spielerTag, karte, provName:id => karte.prov[id].n,
    meldung:text => meldungZeigen({ stunde:spiel.stunde, text }),
    waehleArmee:a => { const us = spiel.armeeEinheiten(a); waehle(us.map(x => x.id), false); if (us.length) karte.fliegeZu(us[0].prov, Math.max(karte.kamera.z, 20)); } });
  wui.aktualisieren();

  // ---------- Kartenmodi ----------
  const GEL_FARBE = { ebene:'#cfd9a2', wald:'#6f9a5a', huegel:'#c9b57a', berg:'#9a8a78', sumpf:'#7fa39a', wueste:'#e6d29a', dschungel:'#3f7a4a', tundra:'#d3dadc' };
  const MODI = [
    ['politisch', 'Politisch', null],
    ['gelaende', 'Gelände', id => GEL_FARBE[spiel.prov[id].t]],
    ['industrie', 'Industrie', id => { const x = Math.min(1, Math.sqrt(spiel.zf[id] + spiel.mf[id]) / 5); return `rgb(${Math.round(236 - 120 * x)},${Math.round(228 - 170 * x)},${Math.round(207 - 180 * x)})`; }],
    ['rohstoffe', 'Rohstoffe', id => spiel.roh.oel[id] ? '#2b2b2b' : spiel.roh.gummi[id] ? '#3f8a4a' : spiel.roh.stahl[id] ? '#6f8296' : '#e6dcc0'],
    ['versorgung', 'Versorgung', id => {
      const v = spielerTag && spiel.versorgung && spiel.versorgung[spielerTag];
      if (!v || !spiel.freund(spiel.kontrolle[id], spielerTag)) return '#d8d2c2';
      const x = v[id]; return x === 0 ? '#c0392b' : `rgb(${Math.round(230 - 150 * x)},${Math.round(120 + 90 * x)},${Math.round(70 + 20 * x)})`;
    }],
    ['wetter', 'Wetter', id => { const w = spiel.wetter(id); return w === 'winter' ? '#f4f8ff' : w === 'schlamm' ? '#8a6a45' : '#cfd9a2'; }]
  ];
  let modus = 0;
  function setzeModus(i){ modus = i; karte.modusFarbe = MODI[i][2]; $('modusKnopf').textContent = 'Karte: ' + MODI[i][1]; karte.schmutzig = true; }
  $('modusKnopf').addEventListener('click', () => setzeModus((modus + 1) % MODI.length));
  addEventListener('keydown', e => { if ((e.key === 'm' || e.key === 'M') && !(e.target.closest && e.target.closest('input'))) setzeModus((modus + 1) % MODI.length); });

  // ---------- Menue: Speichern, Laden, Export/Import, Neues Spiel ----------
  async function menue(){
    const warLauf = laeuft; setzeLauf(false);
    const plaetze = await Speicher.uebersicht();
    await dialog('Menü', (box, zu) => {
      const neuLaden = platz => { autosaveAn = false; merken('epochen.laden', platz); location.reload(); };
      for (const p of ['auto', 'platz1', 'platz2', 'platz3']){
        const m = plaetze[p], zeile = document.createElement('div'); zeile.className = 'platz';
        const info = document.createElement('div');
        const b = document.createElement('b'); b.textContent = p === 'auto' ? 'Autosave' : 'Platz ' + p.slice(-1);
        const k = document.createElement('div'); k.className = 'klein'; k.textContent = m ? `${m.datumText}${m.staat ? ' · ' + m.staat : ''}` : 'leer';
        info.append(b, k); zeile.append(info);
        if (p !== 'auto') zeile.append(knopf('Speichern', '', async () => { await Speicher.schreiben(p, eintrag()); zu(); meldungZeigen({ stunde:spiel.stunde, text:'Gespeichert.' }); }));
        if (m) zeile.append(knopf('Laden', '', () => neuLaden(p)));
        box.append(zeile);
      }
      const k = document.createElement('div'); k.className = 'knoepfe'; k.style.marginTop = '12px';
      k.append(
        knopf('Kartenstil: ' + (karte.stil === EpochenKarte.STILE.flach ? 'Lesbar' : 'Generalstab'), '', () => { stil(karte.stil === EpochenKarte.STILE.flach ? 'generalstab' : 'flach'); zu(); }),
        knopf('Als Datei exportieren', '', () => Speicher.exportieren(eintrag())),
        knopf('Datei importieren', '', async () => {
          const e = await Speicher.importieren();
          if (!e){ meldungZeigen({ stunde:spiel.stunde, text:'Die Datei ist kein Epochen-Spielstand.' }); return; }
          await Speicher.schreiben('import', e); neuLaden('import');
        }),
        knopf('Neues Spiel', 'krieg', async () => { autosaveAn = false; await Speicher.loeschen('auto'); location.reload(); })
      );
      const ds = document.createElement('a'); ds.href = '/datenschutz'; ds.textContent = 'Datenschutz'; ds.className = 'klein'; ds.style.display = 'block'; ds.style.marginTop = '10px'; ds.style.color = 'var(--leise)';

      box.append(k, ds);
    });
    if (warLauf) setzeLauf(true);
  }
  $('menueKnopf').addEventListener('click', menue);

  // ---------- Start ----------
  if (spielerTag) karte.fliegeZu(welt.staaten[spielerTag].hauptstadt, 9);
  else { karte.kamera.x = 15; karte.kamera.y = EpochenKarte.projY(50); karte.kamera.z = Math.max(6, innerWidth / 70); karte.begrenzen(); }

  // Debug-Zugriff
  window.epochen = { karte, welt, prov, spiel, ansicht, wui, speichern:autosave, sim:h => { for (let i = 0; i < h; i++) spiel.schritt(); if (spiel.aenderung){ spiel.aenderung = false; karte.baueGrenzen(); } zeigeDatum(); aktualisierePanels(); karte.schmutzig = true; } };
})();
