'use strict';
// Epochen – Oberflaeche um die Karte: Laden, Info-Panel, Tooltip, Kartenstil, Nationswahl.
(async function(){
  const $ = id => document.getElementById(id);
  const merken = (k, v) => { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const holen = k => { try { return localStorage.getItem(k); } catch { return null; } };

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
  $('laden').classList.add('weg');

  // Kartenstil
  const stilKnoepfe = document.querySelectorAll('.umschalter button');
  function stil(name){
    karte.setzeStil(name);
    stilKnoepfe.forEach(b => b.classList.toggle('an', b.dataset.stil === name));
    merken('epochen.stil', name);
  }
  stilKnoepfe.forEach(b => b.addEventListener('click', () => stil(b.dataset.stil)));
  stil(holen('epochen.stil') === 'flach' ? 'flach' : 'generalstab');

  // Hilfe
  $('hilfeKnopf').addEventListener('click', () => { $('hilfe').hidden = false; });
  $('hilfeZu').addEventListener('click', () => { $('hilfe').hidden = true; merken('epochen.hilfe', '1'); });
  $('hilfe').addEventListener('click', e => { if (e.target.id === 'hilfe') $('hilfe').hidden = true; });
  if (!holen('epochen.hilfe')) $('hilfe').hidden = false;

  // Tooltip (nur Maus)
  const tipp = $('tipp');
  karte.beiHover = (id, p) => {
    if (id < 0){ tipp.hidden = true; return; }
    const s = karte.staat(karte.besitz[id]);
    tipp.innerHTML = '';
    tipp.append(karte.prov[id].n, ' ');
    const k = document.createElement('span'); k.className = 'klein'; k.textContent = '· ' + s.n; tipp.append(k);
    tipp.hidden = false;
    const x = Math.min(innerWidth - tipp.offsetWidth - 8, p[0] + 14), y = Math.min(innerHeight - 40, p[1] + 16);
    tipp.style.left = x + 'px'; tipp.style.top = y + 'px';
  };

  // Info-Panel
  const zahl = n => n.toLocaleString('de-DE');
  let spielerTag = holen('epochen.nation');
  if (spielerTag && !welt.staaten[spielerTag]) spielerTag = null;
  function zeigeSpieler(){
    const el = $('spieler'); el.innerHTML = '';
    if (!spielerTag) return;
    const s = welt.staaten[spielerTag];
    const f = document.createElement('span'); f.className = 'flagge'; f.style.background = s.f;
    el.append('Du führst: ', f, s.n);
  }
  zeigeSpieler();
  karte.beiKlick = id => {
    if (id < 0){ $('panel').hidden = true; karte.auswahlStaat = null; karte.schmutzig = true; return; }
    const p = karte.prov[id], tag = karte.besitz[id], s = karte.staat(tag);
    $('pName').textContent = p.n;
    $('pStaat').textContent = s.n;
    $('pFarbe').style.background = s.f;
    $('pFlaeche').textContent = zahl(p.a) + ' km²';
    $('pNachbarn').textContent = p.nb.length;
    $('pAnzahl').textContent = karte.besitz.filter(t => t === tag).length;
    $('pHaupt').textContent = s.hn || karte.prov[s.hauptstadt].n;
    const ober = s.oberherr && karte.staat(s.oberherr);
    $('pStaat').textContent = ober ? s.n + ' · unter ' + ober.n : s.n;
    $('pSpielen').textContent = spielerTag === tag ? 'Deine Nation' : 'Als ' + s.n + ' spielen';
    $('pSpielen').onclick = () => { spielerTag = tag; merken('epochen.nation', tag); zeigeSpieler(); $('pSpielen').textContent = 'Deine Nation'; };
    $('pHaupt2').onclick = () => karte.fliegeZu(s.hauptstadt, Math.max(karte.kamera.z, 14));
    karte.auswahlStaat = tag; karte.schmutzig = true;
    $('panel').hidden = false;
  };
  $('panelZu').addEventListener('click', () => { $('panel').hidden = true; karte.auswahl = -1; karte.auswahlStaat = null; karte.schmutzig = true; });
  addEventListener('keydown', e => { if (e.key === 'Escape') $('panelZu').click(); });

  // Start: Europa, oder die eigene Nation
  if (spielerTag) karte.fliegeZu(welt.staaten[spielerTag].hauptstadt, 9);
  else { karte.kamera.x = 15; karte.kamera.y = EpochenKarte.projY(50); karte.kamera.z = Math.max(6, innerWidth / 70); karte.begrenzen(); }

  // Debug-Zugriff
  window.epochen = { karte, welt, prov };
})();
