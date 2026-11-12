import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { Link } from "react-router-dom";
import Chart from "../components/Chart";
import { Card, Kpi, Page, Seg } from "../components/Layout";
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
const PRESET = [{ v: 15, l: "15 · WHO harian" }, { v: 55, l: "55 · baku mutu" }, { v: 150, l: "150 · ambang" }];

const RECS = [
  { who: "Dinkes & BPBD wilayah gambut", what: "Siaga RS musim asap", when: "Mulai akhir Juli (minggu ke-31); penuh saat PM2.5 > 150", ev: "/waktu", evl: "Kalender risiko", gain: "Palangka Raya 2026, batas 55: −1.050 ISPA balita, −510 kematian" },
  { who: "KLHK & Pemda", what: "Cegah karhutla sebelum kemarau", when: "Juni–Juli, sebelum pita asap muncul", ev: "/pemicu", evl: "82% variasi dari musim", gain: "Tuas terbesar untuk lonjakan (episode berat 2026: 198 hari)" },
  { who: "Pemprov DKI & kota padat", what: "Kendalikan emisi jam sibuk", when: "06–09 & 17–19 setiap hari", ev: "/pemicu", evl: "Lalu lintas ρ = 0,78", gain: "Marunda −30% PM2.5: −711 ISPA balita, −197 kematian/tahun" },
  { who: "KLHK", what: "Tambahkan PM2.5 ke IKU", when: "Revisi Permen LHK 27/2021", ev: "/kondisi", evl: "IKU 'buta asap'", gain: "12 stasiun ber-IKU 'Baik' padahal gagal target WHO IT-1" },
  { who: "Dinkes & Puskesmas", what: "Lindungi balita dan lansia", when: "Hari ISPU ≥ Tidak Sehat (PM2.5 > 55)", ev: "/dampak", evl: "Balita vs lansia", gain: "Risiko sama (+56% vs +51%); 411 ribu kasus ISPA tercatat" },
  { who: "Pengelola jaringan AQMS", what: "Perbaiki & audit sensor", when: "Segera: JMB-02, MER-01, BJB-01, SM2-01", ev: "/jaringan", evl: "Rapor data", gain: "QC berbasis nilai menangkap 7.329 jam data beku berlabel VALID" },
  { who: "KLHK", what: "Relokasi unit redundan", when: "Siklus anggaran berikutnya", ev: "/jaringan", evl: "Garis bukti", gain: "JMB-02 & satu unit KTG → koridor gambut yang belum terpantau" },
];

export default function Q6Aksi() {
  const d = useData<[HospitalDaily, ModelDampak, AngkaKunci]>("hospital_daily", "model_dampak", "angka_kunci");
  const { pilihan, byCode } = useApp();
  const firstSim = pilihan.map((c) => byCode[c]).find((s) => s?.simulasi)?.hospital_id ?? "RS-XXX-04";
  const [rs, setRs] = useState<string>(firstSim);
  useEffect(() => { setRs(firstSim); }, [firstSim]);
  const [per, setPer] = useState<PerKey>("2025");
  const [jenis, setJenis] = useState<"batas" | "kurangi">("batas");
  const [batas, setBatas] = useState(55);
  const [kurangi, setKurangi] = useState(30);
  const sk: Skenario = jenis === "batas" ? { jenis, nilai: batas } : { jenis, persen: kurangi };

  const res = useMemo(() => {
    if (!d) return null;
    const list = rs === "all" ? d[0].model : [rs];
    return simulate(d[0], d[1], list, sk, PER[per].from, PER[per].to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, rs, per, jenis, batas, kurangi]);

  if (!d || !res) return <div className="loading">Memuat data simulasi…</div>;
  const [h] = d;
  const rsCode = rs === "all" ? null : h.rs[rs].code;
  const rsName = rsCode ? `${byCode[rsCode].rs_nama} (${byCode[rsCode].nama})` : "Semua 25 RS";

  const barOpt: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: any) => fmtPct(v, 1, true) },
    grid: { left: 8, right: 50, top: 6, bottom: 6 },
    xAxis: { type: "value", show: false }, yAxis: { type: "category", data: res.map((r) => r.outcome), inverse: true },
    series: [{ type: "bar", data: res.map((r) => ({ value: r.persen, itemStyle: { color: r.persen <= 0 ? C.focus : C.alert } })),
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

  return (
    <Page path="/aksi"
      kpis={<>
        {["ISPA balita", "ISPA lansia", "Rawat napas umum", "Kematian"].map((o) => {
          const r = res.find((x) => x.outcome === o);
          return <Kpi key={o} k={`${o} yang bisa dicegah`} v={r ? fmt(Math.max(0, -r.selisih), 0) : "–"} unit="kasus" note={r ? `${fmtPct(r.persen, 1, true)} · ${rsCode ? byCode[rsCode].nama : "25 RS"} · ${PER[per].label}` : ""} />;
        })}
      </>}
      main={
        <Card title="Simulator kebijakan" sub={`${rsName} · ${PER[per].label}. Angka di atas ikut berubah saat batas digeser.`}>
          <div className="sim">
            <div className="sim-ctrl">
              <label>Rumah sakit / wilayah
                <select value={rs} onChange={(e) => setRs(e.target.value)}>
                  <option value="all">Semua 25 RS (nasional)</option>
                  {h.model.map((hid) => { const s = byCode[h.rs[hid].code]; return <option key={hid} value={hid}>{s.nama} · {s.provinsi}</option>; })}
                </select>
              </label>
              <label>Periode
                <select value={per} onChange={(e) => setPer(e.target.value as PerKey)}>
                  {(Object.keys(PER) as PerKey[]).map((k) => <option key={k} value={k}>{PER[k].label}</option>)}
                </select>
              </label>
              <div>
                <Seg value={jenis} onChange={setJenis} options={[["batas", "Batas maksimum"], ["kurangi", "Kurangi %"]]} />
              </div>
              {jenis === "batas" ? (
                <label>PM2.5 harian tidak boleh melewati <b style={{ fontSize: 18 }}>{batas} {UG}</b>
                  <input type="range" min={15} max={300} step={1} value={batas} onChange={(e) => setBatas(Number(e.target.value))} />
                  <span className="presets">{PRESET.map((p) => <button key={p.v} aria-pressed={batas === p.v} onClick={() => setBatas(p.v)}>{p.l}</button>)}</span>
                </label>
              ) : (
                <label>PM2.5 turun <b style={{ fontSize: 18 }}>{kurangi}%</b> setiap hari
                  <input type="range" min={0} max={80} step={5} value={kurangi} onChange={(e) => setKurangi(Number(e.target.value))} />
                </label>
              )}
            </div>
            <div>
              <table className="sim-out">
                <thead><tr><th>Penyakit</th><th>Kasus aktual</th><th>Skenario</th><th>Selisih</th><th>%</th></tr></thead>
                <tbody>
                  {res.map((r) => (
                    <tr key={r.key}>
                      <td>{r.outcome}</td><td>{fmt(r.aktual, 0)}</td><td>{fmt(r.skenario, 0)}</td>
                      <td className={r.selisih < -0.5 ? "neg" : r.selisih > 0.5 ? "pos" : ""}>{r.selisih > 0 ? "+" : ""}{fmt(r.selisih, 0)}</td>
                      <td>{fmtPct(r.persen, 1, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="disclaimer"><b>Catatan:</b> estimasi berdasarkan model statistik dari data sintetis; menunjukkan arah dan besaran relatif, bukan prediksi pasti.</p>
            </div>
          </div>
          <div className="grid-sup two" style={{ marginTop: 14 }}>
            <div><h3>Perubahan kasus</h3><Chart option={barOpt} height={220} /></div>
            <div><h3>{rsCode ? "PM2.5 harian: aktual vs skenario" : "Pilih satu RS untuk melihat grafik harian"}</h3>{series ? <Chart option={series} height={220} /> : <p className="note">Grafik harian hanya untuk satu RS.</p>}</div>
          </div>
        </Card>
      }
      method="kasus skenario = kasus aktual × (PM skenario / PM aktual)^(b/ln 2), b per RS (empirical Bayes shrinkage). Kardiovaskular & kematian memakai model ambang 150 µg/m³. Dihitung langsung di browser dari data harian."
      extra={
        <section style={{ marginTop: 18 }}>
          <h2 className="section-title" style={{ marginTop: 6 }}>Rekomendasi</h2>
          <div className="recs">
            {RECS.map((r, i) => (
              <article key={i} className="card rec">
                <div className="who">{i + 1}. {r.who}</div>
                <h3 style={{ marginTop: 4 }}>{r.what}</h3>
                <dl>
                  <dt>Kapan</dt><dd>{r.when}</dd>
                  <dt>Bukti</dt><dd><Link to={r.ev}>{r.evl} →</Link></dd>
                  <dt>Manfaat</dt><dd><b>{r.gain}</b></dd>
                </dl>
              </article>
            ))}
          </div>
        </section>
      }
    />
  );
}
