'use strict';
// Epochen – Simulationstest: KI gegen KI, Wirtschaft ueber mehrere Jahre, Speichern/Laden-Determinismus.
//   node werkzeug/simtest.js [seed] [jahre]
const L = require('../public/logik.js');
require('../public/wirtschaft.js');
require('../public/fronten.js');
require('../public/seefahrt.js');
const prov = require('../daten/provinzen.json').provinzen;
const welt = require('../daten/epochen/1936/welt.json');
const seed = +process.argv[2] || 1, jahre = +process.argv[3] || 3;

const meer = require('../daten/meer.json');
const s = new L.Spiel(prov, welt, { seed, meer });
s.beiMeldung = m => { if (m.wichtig) console.log('  Tag', Math.floor(m.stunde / 24), m.text); };
const zeile = t => {
  const k = s.kennzahlen(t), w = s.wi[t];
  return `${t} ZF ${k.zf.toFixed(0)} MF ${k.mf.toFixed(0)} Div ${s.einheiten.filter(u => u.staat === t).length}` +
    ` Lager ${w.lager.ausruestung}/${w.lager.panzer} Mann ${(k.mann / 1e3).toFixed(0)}k Bau ${w.bau.length}`;
};
const t0 = Date.now();
for (let j = 0; j < jahre; j++){
  if (j === 1){ s.kriegErklaeren('GER', 'POL'); s.kriegErklaeren('SOV', 'FIN'); }
  for (let h = 0; h < 24 * 365; h++) s.schritt();
  console.log(`Ende ${1936 + j}:`);
  for (const t of ['GER', 'SOV', 'USA', 'ENG', 'FRA', 'ITA', 'JAP', 'POL', 'FIN']) console.log('  ' + zeile(t));
}
console.log('Laufzeit', Date.now() - t0, 'ms');

// Determinismus: Stand speichern, beide Spiele 60 Tage weiter, vergleichen
const stand = JSON.parse(JSON.stringify(s.stand()));
const s2 = new L.Spiel(prov, welt, { stand, meer });
s.beiMeldung = null;
for (let h = 0; h < 24 * 60; h++){ s.schritt(); s2.schritt(); }
const a = JSON.stringify(s.stand()), b = JSON.stringify(s2.stand());
console.log('Determinismus nach Laden:', a === b ? 'OK' : 'ABWEICHUNG', (a.length / 1024).toFixed(0) + ' KB');
