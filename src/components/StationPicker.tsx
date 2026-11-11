import { useState } from "react";
import { PULAU, useApp } from "../lib/state";
import { PICK_COL, PICK_GLYPH } from "../lib/theme";

/** Pemilih Stasiun Pilihan (maks. 3). Dipakai di bar atas dan di grafik garis. */
export default function StationPicker({ label = "Stasiun pilihan", compact = false }: { label?: string; compact?: boolean }) {
  const app = useApp();
  const [adding, setAdding] = useState(false);
  const byPulau = PULAU.map((p) => ({ p, list: app.stations.filter((s) => s.pulau === p && !s.dikecualikan) }));
  return (
    <div className="chips" aria-label={label}>
      {label && <span className="flabel">{label}</span>}
      {app.pilihan.map((c, i) => (
        <span className="chip pick" key={c} style={{ borderColor: PICK_COL[i] + "55" }}>
          <b style={{ color: PICK_COL[i] }} aria-hidden>{PICK_GLYPH[i]}</b>
          <button className="link-btn" style={{ textDecoration: "none", color: "var(--ink)", padding: 0 }} onClick={() => app.openProfil(c)} title="Buka profil stasiun">
            {app.byCode[c]?.nama}
          </button>
          <button aria-label={`Hapus ${app.byCode[c]?.nama}`} onClick={() => app.togglePilihan(c)}>×</button>
        </span>
      ))}
      {app.pilihan.length < 3 ? (adding ? (
        <select autoFocus className="pick-select" onBlur={() => setAdding(false)} onChange={(e) => { if (e.target.value) app.togglePilihan(e.target.value); setAdding(false); }}>
          <option value="">Pilih stasiun…</option>
          {byPulau.map(({ p, list }) => (
            <optgroup key={p} label={p}>
              {list.filter((s) => !app.pilihan.includes(s.code)).map((s) => <option key={s.code} value={s.code}>{s.nama} · {s.kelompok}</option>)}
            </optgroup>
          ))}
        </select>
      ) : <button className="chip" onClick={() => setAdding(true)} style={{ paddingRight: 10 }}>+ Tambah</button>)
        : !compact && <span className="note" style={{ margin: 0 }}>maks. 3 · hapus satu untuk mengganti</span>}
      <button className="link-btn" onClick={() => app.set("pilih", null)} title="Kembalikan ke Marunda, Palangka Raya, Kototabang">Reset</button>
    </div>
  );
}
