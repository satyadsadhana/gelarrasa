import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { Link } from "react-router-dom";
import Chart from "../components/Chart";
import NavIcon from "../components/NavIcon";
import { Card, Page, Seg } from "../components/Layout";
import { Count, Reveal } from "../components/Viz";
import { useData } from "../lib/data";
import { fmt, fmtDate, fmtPct, UG } from "../lib/format";
import { apply, simulate, type Skenario } from "../lib/sim";
import { dateAt, useApp } from "../lib/state";
import type { AngkaKunci, HospitalDaily, ModelDampak } from "../lib/types";
import { C } from "../lib/theme";

const PER = {
  "2025": { label: "Tahun 2025", from: "2025-01-01", to: "2025-12-31" },
  asap2026: { label: "Musim asap 2026 (1 Jul–14 Okt)", from: "2026-07-01", to: "2026-10-14" },
  "2024": { label: "Tahun 2024", from: "2024-01-01", to: "2024-12-31" },
  semua: { label: "2024 – 14 Okt 2026", from: "2024-01-01", to: "2026-10-14" },
} as const;
type PerKey = keyof typeof PER;
const MIN = 15, MAX = 300;
const PRESET = [{ v: 15, l: "WHO harian", s: "15" }, { v: 55, l: "Baku mutu nasional", s: "55" }, { v: 150, l: "Ambang jantung", s: "150" }];

/** Rekomendasi disusun menurut WAKTU pelaksanaan (fase), bukan sekadar daftar. */
const FASE = [
  { id: "segera", t: "Segera", s: "0–3 bulan" },
  { id: "pra", t: "Sebelum Kemarau", s: "Juni–Juli" },
  { id: "asap", t: "Saat Musim Asap", s: "Mulai minggu ke-31" },
  { id: "harian", t: "Setiap Hari", s: "Jam sibuk kota" },
  { id: "panjang", t: "Jangka Panjang", s: "Siklus anggaran" },
] as const;
const RECS = [
  { f: "segera", ico: "sensor", who: "Pengelola jaringan AQMS", what: "Perbaiki dan Audit Sensor", when: "Segera: JMB-02, MER-01, BJB-01, SM2-01", ev: "/jaringan", evl: "Rapor data", gain: "QC berbasis nilai menangkap 7.329 jam data beku berlabel VALID" },
  { f: "segera", ico: "aturan", who: "KLHK", what: "Tambahkan PM2.5 ke IKU", when: "Revisi Permen LHK 27/2021", ev: "/kondisi", evl: "IKU 'buta asap'", gain: "12 stasiun ber-IKU 'Baik' padahal gagal target WHO IT-1" },
  { f: "pra", ico: "pemda", who: "KLHK & Pemda", what: "Cegah Karhutla sebelum Kemarau", when: "Juni–Juli, sebelum pita asap muncul", ev: "/pemicu", evl: "82% variasi dari musim", gain: "Tuas terbesar untuk lonjakan (2026: 160 hari asap berat di kawasan gambut)" },
  { f: "asap", ico: "rs", who: "Dinkes & BPBD wilayah gambut", what: "Siaga Rumah Sakit Musim Asap", when: "Mulai akhir Juli (minggu ke-31); penuh saat PM2.5 > 150", ev: "/waktu", evl: "Kalender risiko", gain: "Palangka Raya 2026, batas 55: −1.050 ISPA balita, −510 kematian" },
  { f: "asap", ico: "orang", who: "Dinkes & Puskesmas", what: "Lindungi Balita dan Lansia", when: "Hari ISPU ≥ Tidak Sehat (PM2.5 > 55)", ev: "/dampak", evl: "Balita vs lansia", gain: "Risiko sama (+56% vs +51%); 411 ribu kasus ISPA tercatat" },
  { f: "harian", ico: "/pemicu", who: "Pemprov DKI & kota padat", what: "Kendalikan Emisi Jam Sibuk", when: "06–09 & 17–19 setiap hari", ev: "/pemicu", evl: "Lalu lintas ρ = 0,78", gain: "Marunda −30% PM2.5: −711 ISPA balita, −197 kematian/tahun" },
  { f: "panjang", ico: "/jaringan", who: "KLHK", what: "Verifikasi Unit Kembar di Kalteng", when: "Siklus anggaran berikutnya", ev: "/jaringan", evl: "Garis bukti", gain: "KTG-01 & KTG-02 nyaris identik (selisih level 0,1%, jarak 112 km). Bila terbukti duplikat, satu unit bisa dipindah ke koridor gambut yang belum terpantau" },
];

/** Satu kartu hasil: angka kasus tercegah + piktogram orang (1 ikon = N kasus). */
function Pictos({ label, sub, row, ico }: { label: string; sub: string; row?: { selisih: number; persen: number; aktual: number }; ico: "balita" | "lansia" | "jantung" }) {
  const saved = row ? Math.max(0, -row.selisih) : 0;
  const unit = saved <= 0 ? 1 : [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((u) => saved / u <= 40) ?? 1000;
  const lit = Math.round(saved / unit);
  const total = Math.max(40, lit);
  return (
    <div className={`picto t-${ico}`}>
      <div className="picto-head">
        <b className="picto-n">{row ? <>{row.selisih > 0.5 ? "+" : row.selisih < -0.5 ? "−" : ""}<Count to={Math.abs(row.selisih)} /></> : "–"}</b>
        <span><strong>{label}</strong><small>{sub}{row ? ` · ${fmtPct(row.persen, 1, true)}` : ""}</small></span>
      </div>
      <div className="picto-grid" aria-hidden>
        {Array.from({ length: total }, (_, k) => (
          <i key={k} className={k < lit ? "lit" : ""} style={{ "--k": k } as React.CSSProperties}>
            <svg viewBox="0 0 24 24" width="100%" height="100%">
              {ico === "balita"
                ? <><circle cx="12" cy="8" r="4.2" /><path d="M6.5 22v-4.5a5.5 5.5 0 0 1 11 0V22z" /></>
                : ico === "lansia"
                  ? <><circle cx="11" cy="5" r="3" /><path d="M7 22v-8.5A4 4 0 0 1 11 9.5a4 4 0 0 1 4 4V22z" /><path d="M18 12v10" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></>
                  : <path d="M12 21s-8-4.9-8-11a4.4 4.4 0 0 1 8-2.4A4.4 4.4 0 0 1 20 10c0 6.1-8 11-8 11z" />}
            </svg>
          </i>
        ))}
      </div>
      <p className="picto-key">Satu ikon terang = {fmt(unit, 0)} kasus {row && row.selisih > 0.5 ? "bertambah" : "tercegah"}</p>
    </div>
  );
}

export default function Q6Aksi() {
  const d = useData<[HospitalDaily, ModelDampak, AngkaKunci]>("hospital_daily", "model_dampak", "angka_kunci");
  const { pilihan, byCode } = useApp();
  const firstSim = pilihan.map((c) => byCode[c]).find((s) => s?.simulasi)?.hospital_id ?? "RS-XXX-04";
  const [rs, setRs] = useState<string>("all");
  useEffect(() => { setRs((r) => (r === "all" ? r : firstSim)); }, [firstSim]);
  const [per, setPer] = useState<PerKey>("2025");
  const [jenis, setJenis] = useState<"batas" | "kurangi">("batas");
  const [batas, setBatas] = useState(55);
  const [kurangi, setKurangi] = useState(30);
  const [open, setOpen] = useState<number | null>(null);
  const sk: Skenario = jenis === "batas" ? { jenis, nilai: batas } : { jenis, persen: kurangi };

  const res = useMemo(() => {
    if (!d) return null;
    const list = rs === "all" ? d[0].model : [rs];
    return simulate(d[0], d[1], list, sk, PER[per].from, PER[per].to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, rs, per, jenis, batas, kurangi]);

  if (!d || !res) return <div className="loading">Memuat data simulasi…</div>;
  const [h, , ak] = d;
  const beban = ak.beban_2025_batas55["ISPA balita"];
  const rsCode = rs === "all" ? null : h.rs[rs].code;
  const rsName = rsCode ? `${byCode[rsCode].rs_nama} (${byCode[rsCode].nama})` : "Semua 25 rumah sakit";
  const row = (l: string) => res.find((r) => r.outcome === l);
  const maxAbs = Math.max(...res.map((r) => Math.abs(r.persen)), 1);

  const barOpt: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: any) => fmtPct(v, 1, true) },
    grid: { left: 8, right: 56, top: 6, bottom: 6 },
    xAxis: { type: "value", show: false }, yAxis: { type: "category", data: res.map((r) => r.outcome), inverse: true, axisLabel: { fontSize: 12, color: C.ink } },
    series: [{ type: "bar", barWidth: 14, data: res.map((r) => ({ value: r.persen, itemStyle: { color: r.persen <= 0 ? C.focus : C.alert, borderRadius: 4 } })),
      label: { show: true, position: "right", formatter: (p: any) => fmtPct(p.value, 1, true), fontWeight: 700 } }],
  };

  let series: EChartsOption | null = null;
  if (rsCode) {
    const r = h.rs[rs];
    const idx: number[] = [];
    for (let i = 0; i < h.n; i++) { const dt = dateAt(i); if (dt >= PER[per].from && dt <= PER[per].to) idx.push(i); }
    series = {
      tooltip: { trigger: "axis", valueFormatter: (v: any) => `${fmt(v)} ${UG}` },
      legend: { bottom: 0 }, grid: { left: 8, right: 10, top: 10, bottom: 34 },
      xAxis: { type: "category", data: idx.map((i) => fmtDate(dateAt(i))), axisLabel: { fontSize: 10 } }, yAxis: { type: "value", name: UG },
      series: [
        { name: "PM2.5 aktual", type: "line", symbol: "none", data: idx.map((i) => r.pm25[i]), itemStyle: { color: C.other }, areaStyle: { opacity: 0.18 } },
        { name: "PM2.5 skenario", type: "line", symbol: "none", data: idx.map((i) => (r.pm25[i] == null ? null : apply(sk, Math.max(1, r.pm25[i]!)))), itemStyle: { color: C.focus }, lineStyle: { width: 2 } },
      ],
    };
  }
  const val = jenis === "batas" ? batas : kurangi;
  const pctPos = (v: number) => `${((v - MIN) / (MAX - MIN)) * 100}%`;
  const bal = row("ISPA balita");

  return (
    <Page path="/aksi" stageCap={jenis === "batas" ? batas : null}
      headline={beban ? `Batas Harian 55 µg/m³ pada 2025 Berarti ${fmt(-beban.kasus, 0)} Kasus ISPA Balita Lebih Sedikit` : "Simulasi dan Rekomendasi"}
      method="Kasus skenario = kasus aktual × (PM skenario ÷ PM aktual)^(b ÷ ln 2), b per RS (empirical Bayes shrinkage). Kardiovaskular dan kematian memakai model ambang 150 µg/m³. Dihitung langsung di browser dari data harian. Estimasi dari model statistik pada data sintetis: menunjukkan arah dan besaran relatif, bukan prediksi pasti."
      main={<>
        <Reveal as="section" className="sim-deck">
          <div className="sim-top">
            <div>
              <h2>Geser Batasnya</h2>
              <p>Tiang di peta ikut terpotong. Angka di bawah dihitung ulang setiap kali Anda menggeser.</p>
            </div>
            <Seg value={jenis} onChange={setJenis} options={[["batas", "Batas Maksimum"], ["kurangi", "Kurangi Persen"]]} />
          </div>
          <div className="sim-dial">
            <div className="sim-big">
              <span>{jenis === "batas" ? "PM2.5 harian tidak boleh melewati" : "PM2.5 diturunkan setiap hari sebesar"}</span>
              <b>{val}<small>{jenis === "batas" ? ` ${UG}` : "%"}</small></b>
            </div>
            {jenis === "batas" ? (
              <div className="sim-range">
                <input type="range" min={MIN} max={MAX} step={1} value={batas} onChange={(e) => setBatas(Number(e.target.value))} aria-label="Batas PM2.5 harian"
                  style={{ "--fill": pctPos(batas) } as React.CSSProperties} />
                <div className="ticks">
                  {PRESET.map((p) => (
                    <button key={p.v} style={{ left: pctPos(p.v) }} aria-pressed={batas === p.v} onClick={() => setBatas(p.v)}>
                      <b>{p.s}</b><small>{p.l}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="sim-range">
                <input type="range" min={0} max={80} step={5} value={kurangi} onChange={(e) => setKurangi(Number(e.target.value))} aria-label="Persen penurunan PM2.5"
                  style={{ "--fill": `${(kurangi / 80) * 100}%` } as React.CSSProperties} />
                <div className="ticks plain"><span style={{ left: "0%" }}>0%</span><span style={{ left: "50%" }}>40%</span><span style={{ left: "100%" }}>80%</span></div>
              </div>
            )}
          </div>
          <div className="sim-where">
            <label>Rumah Sakit
              <select value={rs} onChange={(e) => setRs(e.target.value)}>
                <option value="all">Semua 25 rumah sakit</option>
                {h.model.map((hid) => { const s = byCode[h.rs[hid].code]; return <option key={hid} value={hid}>{s.nama} · {s.provinsi}</option>; })}
              </select>
            </label>
            <label>Periode
              <select value={per} onChange={(e) => setPer(e.target.value as PerKey)}>
                {(Object.keys(PER) as PerKey[]).map((k) => <option key={k} value={k}>{PER[k].label}</option>)}
              </select>
            </label>
            <p className="sim-live">{bal && bal.selisih < -0.5
              ? <><b>{rsName}</b>, {PER[per].label.toLowerCase()}: <b>{fmt(-bal.selisih, 0)}</b> kasus ISPA balita lebih sedikit.</>
              : <><b>{rsName}</b>, {PER[per].label.toLowerCase()}: batas ini belum mengubah kasus, karena PM2.5 jarang melewatinya.</>}</p>
          </div>
        </Reveal>

        <div className="sec-head"><h2>Yang Berubah di Rumah Sakit</h2><p>{rsName} · {PER[per].label}</p></div>
        <Reveal as="section" className="pictos">
          <Pictos label="ISPA Balita" sub="Infeksi saluran napas anak di bawah 5 tahun" row={row("ISPA balita")} ico="balita" />
          <Pictos label="ISPA Lansia" sub="Infeksi saluran napas usia di atas 60 tahun" row={row("ISPA lansia")} ico="lansia" />
          <Pictos label="Kematian" sub="Semua sebab, di rumah sakit pasangan" row={row("Kematian")} ico="jantung" />
        </Reveal>

        <div className="sim-charts">
          <Card title="Perubahan Kasus, Tujuh Penyakit" sub="Persen terhadap kasus aktual pada periode yang sama">
            <Chart option={barOpt} height={250} ariaLabel="Perubahan kasus per penyakit" />
          </Card>
          <Card title={rsCode ? "PM2.5 Harian: Aktual vs Skenario" : "PM2.5 Harian per Rumah Sakit"} sub={rsCode ? rsName : "Pilih satu rumah sakit di panel atas untuk melihat garis hariannya."}>
            {series ? <Chart option={series} height={250} ariaLabel="PM2.5 harian aktual dan skenario" />
              : <div className="sim-empty"><NavIcon path="rs" size={34} /><p>Grafik harian hanya tersedia untuk satu rumah sakit.</p><button onClick={() => setRs(firstSim)}>Tampilkan {byCode[h.rs[firstSim]?.code]?.nama ?? "contoh"}</button></div>}
          </Card>
        </div>

        <Card title="Tabel Lengkap per Penyakit" sub="Jumlah kasus tercatat dibandingkan skenario">
          <div className="tbl-wrap">
            <table className="sim-out">
              <thead><tr><th>Penyakit</th><th>Kasus Aktual</th><th>Skenario</th><th>Selisih</th><th className="bar-col">Perubahan</th></tr></thead>
              <tbody>
                {res.map((r) => (
                  <tr key={r.key}>
                    <td>{r.outcome}</td><td>{fmt(r.aktual, 0)}</td><td>{fmt(r.skenario, 0)}</td>
                    <td className={r.selisih < -0.5 ? "neg" : r.selisih > 0.5 ? "pos" : ""}>{r.selisih > 0 ? "+" : ""}{fmt(r.selisih, 0)}</td>
                    <td className="bar-col"><span className="inbar"><i className={r.persen <= 0 ? "neg" : "pos"} style={{ width: `${(Math.abs(r.persen) / maxAbs) * 100}%` }} /></span><span>{fmtPct(r.persen, 1, true)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </>}
      extra={
        <section className="recs-wrap">
          <div className="sec-head"><h2>Tujuh Langkah, Disusun Menurut Waktu</h2><p>Klik langkah untuk melihat kapan, manfaat, dan buktinya di halaman sebelumnya.</p></div>
          <Reveal as="ol" className="plan">
            {FASE.map((f, fi) => (
              <li key={f.id} className="phase" style={{ "--k": fi } as React.CSSProperties}>
                <div className="phase-head"><span className="phase-dot" /><b>{f.t}</b><small>{f.s}</small></div>
                <div className="phase-items">
                  {RECS.map((r, ri) => r.f !== f.id ? null : (
                    <div key={ri} className={`act${open === ri ? " open" : ""}`}>
                      <button aria-expanded={open === ri} onClick={() => setOpen(open === ri ? null : ri)}>
                        <span className="act-ico"><NavIcon path={r.ico} size={20} /></span>
                        <span><b>{r.what}</b><small>{r.who}</small></span>
                      </button>
                      {open === ri && (
                        <div className="act-body">
                          <p><span>Kapan</span>{r.when}</p>
                          <p><span>Manfaat</span>{r.gain}</p>
                          <Link to={r.ev}>Lihat buktinya: {r.evl}</Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </Reveal>
        </section>
      }
    />
  );
}
