'use strict';
// Epochen – Speicherstaende im Browser (IndexedDB), dazu Export/Import als Datei.
// Plaetze: "auto" (Autosave jeden Spielmonat), "platz1".."platz3".
(function(){
  const DB = 'epochen', STORE = 'staende';
  let dbVersprechen = null;
  function db(){
    if (dbVersprechen) return dbVersprechen;
    dbVersprechen = new Promise((ok, fehler) => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
        r.onsuccess = () => ok(r.result);
        r.onerror = () => fehler(r.error);
      } catch (e){ fehler(e); }
    });
    return dbVersprechen;
  }
  async function auftrag(modus, fn){
    const d = await db();
    return new Promise((ok, fehler) => {
      const tx = d.transaction(STORE, modus), st = tx.objectStore(STORE), r = fn(st);
      tx.oncomplete = () => ok(r && r.result); tx.onerror = () => fehler(tx.error);
    });
  }
  const Speicher = {
    async holen(platz){ try { return await auftrag('readonly', st => st.get(platz)); } catch { return null; } },
    async schreiben(platz, eintrag){ try { await auftrag('readwrite', st => st.put(eintrag, platz)); return true; } catch { return false; } },
    async loeschen(platz){ try { await auftrag('readwrite', st => st.delete(platz)); } catch {} },
    async uebersicht(){
      const out = {};
      for (const p of ['auto', 'platz1', 'platz2', 'platz3']){ const e = await Speicher.holen(p); out[p] = e ? e.meta : null; }
      return out;
    },
    exportieren(eintrag){
      const blob = new Blob([JSON.stringify(eintrag)], { type:'application/json' });
      const a = document.createElement('a');
      const d = eintrag.meta.datumText.replace(/[^\w]+/g, '-');
      a.href = URL.createObjectURL(blob); a.download = `epochen-${eintrag.meta.spieler || 'zuschauer'}-${d}.epochen`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    importieren(){
      return new Promise(ok => {
        const i = document.createElement('input'); i.type = 'file'; i.accept = '.epochen,application/json';
        i.onchange = async () => {
          try { const e = JSON.parse(await i.files[0].text()); ok(e && e.stand && e.meta ? e : null); } catch { ok(null); }
        };
        i.click();
      });
    }
  };
  window.EpochenSpeicher = Speicher;
})();
