import { useData } from "../lib/data";
import { fmt } from "../lib/format";
import { useApp } from "../lib/state";
import { ISPU_COL, ISPU_LAB, ISPU_ON } from "../lib/theme";

type Log = Record<string, string | number | boolean | null> & { code: string };

const STEPS = [
  ["Mentah", "27 file AQMS per jam + 1 file kesehatan harian (27 RS) + metadata"],
  ["Format", "Satuan ppm → µg/m³ (gas: 25 °C, 1 atm; PM ×1000, asumsi), teks error & inf → kosong, sentinel per stasiun"],
  ["QC", "Flag VALID dipakai; SUSPECT dipakai hanya bila median-nya setara VALID (0,85–1,15×)"],
  ["Fisik", "Nilai negatif, PM2.5 > PM10, kelembapan/arah angin/suhu mustahil → kosong"],
  ["Sensor beku", "Nilai identik ≥24 jam berturut-turut → kosong"],
  ["Waktu", "Timestamp di-floor ke jam, rata-rata per jam, grid 1 jam penuh, celah ≤3 jam diinterpolasi"],
  ["Agregat", "Harian sah bila ≥18 jam valid; tahunan sah bila ≥75% hari valid"],
];
const GLOS = [
  ["ISPU", "Indeks Standar Pencemar Udara (Permen LHK 14/2020): kategori harian Baik–Berbahaya."],
  ["IKU", "Indeks Kualitas Udara (Permen LHK 27/2021): indeks tahunan dari NO₂ & SO₂ saja."],
  ["RR / kenaikan risiko", "Perbandingan kasus ketika PM2.5 berlipat dua, dibanding kondisi biasa RS itu."],
  ["Jeda hari (lag)", "Berapa hari setelah paparan efeknya muncul."],
  ["Plasebo", "PM2.5 sesudah kasus; seharusnya tidak berefek. Dipakai untuk menguji autokorelasi."],
  ["Kontribusi faktor (SHAP)", "Seberapa besar tiap faktor menggeser prediksi model, dirata-rata."],
];

export default function Tentang() {
  const d = useData<[Log[]]>("cleaning_log");
  const { byCode } = useApp();
  const cols: [string, string][] = [["satuan_asli", "Satuan"], ["sel_teks_error", "Teks error"], ["sel_sentinel", "Sentinel"], ["baris_dibuang_qc", "Dibuang QC"], ["SUSPECT_dipakai", "SUSPECT dipakai"], ["baris_pm25>pm10", "PM2.5>PM10"], ["baris_sensor_beku", "Jam beku"], ["jam_pm25_diinterpolasi", "Jam diinterpolasi"], ["cakupan_pm25_%", "Cakupan PM2.5"]];
  return (
    <main>
      <div className="q-head"><p className="page-q">Bagaimana Data Ini Dibersihkan?</p><h1 className="page-title">Tentang Data</h1><p className="page-desc">Dari data mentah ke dashboard: langkah pembersihan, log per stasiun, model yang dipakai, keterbatasan, dan glosarium.</p></div>
      <div className="grid-sup">
        <section className="card" style={{ gridColumn: "span 2" }}>
          <h2>Alur Pembersihan</h2>
          <ol style={{ paddingLeft: 18, marginTop: 10 }}>{STEPS.map(([a, b]) => <li key={a} style={{ fontSize: 13.5, marginBottom: 6 }}><b>{a}:</b> {b}</li>)}</ol>
          <p className="note">JMB-02 rusak total dan dikeluarkan dari analisis polutan; MER-01 hanya punya ±10 hari sah sehingga dikeluarkan dari statistik per stasiun.</p>
        </section>
        <section className="card">
          <h2>Kategori ISPU (PM2.5 24 jam)</h2>
          <table className="tbl" style={{ marginTop: 8 }}><tbody>
            {[["0–15,5"], ["15,6–55,4"], ["55,5–150,4"], ["150,5–250,4"], ["> 250,4"]].map(([r], i) => (
              <tr key={i}><td><span className="pill" style={{ background: ISPU_COL[i], color: ISPU_ON[i] }}>{ISPU_LAB[i]}</span></td><td className="num">{r} µg/m³</td></tr>
            ))}
          </tbody></table>
          <p className="note">IKU = 100 − (50/0,9)·(I_EU − 0,1); I_EU = (NO₂/40 + SO₂/20)/2.</p>
        </section>
      </div>
      <section className="card" style={{ marginTop: 18 }}>
        <h2>Log Pembersihan per Stasiun</h2>
        <div className="tbl-wrap" style={{ marginTop: 8 }}>
          {d ? (
            <table className="tbl"><thead><tr><th>Stasiun</th><th>Status</th>{cols.map(([, l]) => <th key={l} className="num">{l}</th>)}</tr></thead>
              <tbody>{d[0].map((r) => (
                <tr key={r.code}><td><b>{byCode[r.code]?.nama}</b> <span style={{ color: "var(--ink-soft)" }}>{r.code}</span></td><td>{String(r.status_metadata)}</td>
                  {cols.map(([k]) => { const v = r[k]; return <td key={k} className="num">{typeof v === "number" ? (k.endsWith("%") ? `${fmt(v, 1)}%` : fmt(v, 0)) : typeof v === "boolean" ? (v ? "ya" : "tidak") : String(v ?? "–")}</td>; })}
                </tr>))}
              </tbody></table>
          ) : <p className="note">Memuat log pembersihan…</p>}
        </div>
      </section>
      <div className="grid-sup">
        <section className="card"><h2>Kartu Model</h2>
          <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
            <li><b>M1 Tipologi</b>: K-Means pada bentuk pola (lonjakan & musiman), dicek dengan hierarchical (ARI 0,69).</li>
            <li><b>M2 Pemicu</b>: LightGBM + SHAP, latih 2024–2025, uji 2026 (R² 0,72).</li>
            <li><b>M3 Dampak</b>: Poisson dua tahap per RS + meta-analisis random effects; model ambang 150 untuk jantung & kematian; 8 uji sensitivitas.</li>
            <li><b>M4 Anomali</b>: Isolation Forest per stasiun, dibandingkan dengan musim asap.</li>
          </ul>
        </section>
        <section className="card"><h2>Keterbatasan</h2>
          <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
            <li>Data <b>sintetis</b>: hubungan dibaca sebagai asosiasi, bukan bukti kausal.</li>
            <li>Konversi PM dari ppm ×1000 adalah <b>asumsi</b> (dicek ke baseline_pm25).</li>
            <li>2026 hanya sampai 14 Oktober; evaluasi tahunan memakai 2024 & 2025.</li>
            <li>Banyak stasiun berjauhan berbagi pola waktu yang sama (ciri data sintetis), sehingga korelasi antar stasiun tidak dipakai sebagai bukti redundansi.</li>
          </ul>
        </section>
        <section className="card"><h2>Glosarium</h2>
          <dl style={{ fontSize: 13, marginTop: 8 }}>{GLOS.map(([a, b]) => <div key={a} style={{ marginBottom: 6 }}><dt style={{ fontWeight: 700 }}>{a}</dt><dd style={{ margin: 0, color: "var(--ink-soft)" }}>{b}</dd></div>)}</dl>
        </section>
      </div>
    </main>
  );
}
