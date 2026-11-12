import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import Chart from "../components/Chart";
import { Card, Kpi, Page } from "../components/Layout";
import { useData } from "../lib/data";
import { fmt } from "../lib/format";
import { useApp, usePick, useStationFilter } from "../lib/state";
import type { Summary } from "../lib/types";
import { C, GRADE_STYLE, KAT_COL } from "../lib/theme";

type Score = { code: string; status_metadata: string; grade: string; "hari_valid_%": number; "imputasi_%": number; baris_sensor_beku: number; kategori: string; masalah: string };
type Prio = { code: string; skor_risiko: number; "hari_valid_%": number; kategori: string };
type Pairs = { garis_bukti: { a: string; b: string; jenis: string }[]; jmb_jarak_km: number; pasangan_r099: { "beda_level_%": number }[] };
type Anom = { "gambut_di_musim_asap_%": number; data: { code: string; hari_anomali: number; "di_musim_asap_%": number }[] };

const KAT_LAB: Record<string, string> = { Andal: "Andal", "Diakui metadata": "Diakui metadata", "TERSEMBUNYI (status Active)": "Tersembunyi" };

type SortKey = "code" | "grade" | "hari_valid_%" | "imputasi_%" | "baris_sensor_beku" | "kategori";

/** shortcut: salinan Tabel 3.5 laporan (laporan/build_docx.py); ubah keduanya bersamaan. */
const PRIO = [
  { w: "Kalimantan Selatan & Timur", why: "Pulau paling pekat (55,9 µg/m³), tapi Banjarbaru grade D dan Samarinda grade C.", act: "Ganti/kalibrasi sensor, tambah titik gambut Kalsel" },
  { w: "Koridor gambut Kalimantan Tengah", why: "Memburuk +295%, tapi dua dari tiga stasiun memberi deret yang sama.", act: "Pindah satu unit kembar setelah verifikasi lapangan" },
  { w: "Muaro Jambi", why: "JMB-02 rusak (0,5% data) dan hanya 0,87 km dari JMB-01.", act: "Pasang ulang di gambut Mestong" },
  { w: "Papua Selatan", why: "Merauke hanya 1% hari valid: satu provinsi tanpa data sah.", act: "Pulihkan MER-01" },
  { w: "Sumatra Barat & Riau", why: "Kototabang (latar bersih) ikut naik 89% saat musim asap.", act: "Titik antara di jalur sebaran asap" },
];

export default function Q5Jaringan() {
  const d = useData<[Score[], Prio[], Pairs, Anom, Summary[]]>("scorecard", "priority", "pairs", "anomaly", "station_summary");
  const { byCode, openProfil } = useApp();
  const pick = usePick();
  const filt = useStationFilter();
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: "grade", asc: false });

  const rows = useMemo(() => {
    if (!d) return [];
    const r = d[0].filter((s) => filt(s.code));
    const katRank = (k: string) => ["TERSEMBUNYI (status Active)", "Diakui metadata", "Andal"].indexOf(k);
    return [...r].sort((a, b) => {
      let x: number | string = a[sort.k] as any, y: number | string = b[sort.k] as any;
      if (sort.k === "kategori") { x = katRank(a.kategori); y = katRank(b.kategori); }
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sort.asc ? c : -c;
    });
  }, [d, sort, filt]);

  if (!d) return <div className="loading">Memuat rapor jaringan stasiun…</div>;
  const [, prio, , anom] = d;

  const th = (k: SortKey, l: string, num = false) => (
    <th className={num ? "num" : ""} onClick={() => setSort({ k, asc: sort.k === k ? !sort.asc : num ? false : true })} aria-sort={sort.k === k ? (sort.asc ? "ascending" : "descending") : "none"}>
      {l}{sort.k === k ? (sort.asc ? " ▲" : " ▼") : ""}
    </th>
  );

  const prioOpt: EChartsOption = {
    tooltip: { formatter: (p: any) => `<b>${byCode[p.data.code].nama}</b><br/>${fmt(p.value[0], 1)}% hari valid · skor risiko ${fmt(p.value[1], 0)}` },
    grid: { left: 8, right: 16, top: 14, bottom: 30 },
    xAxis: { type: "value", name: "% hari valid", nameLocation: "middle", nameGap: 24, min: 60, max: 100 }, yAxis: { type: "value", name: "skor risiko polusi", min: 0, max: 100 },
    series: [{
      type: "scatter", symbolSize: 12,
      data: prio.map((r) => ({ value: [r["hari_valid_%"], r.skor_risiko], code: r.code, itemStyle: { color: KAT_COL[r.kategori], borderColor: pick(r.code) ?? "#fff", borderWidth: pick(r.code) ? 3 : 1 },
        label: { show: r.kategori !== "Andal", formatter: r.code, position: "right", fontSize: 10, fontWeight: 700 } })),
      markArea: { silent: true, itemStyle: { color: "rgba(180,35,24,0.06)", borderColor: "rgba(180,35,24,0.35)", borderWidth: 1 }, label: { show: true, position: "insideTopLeft", formatter: "Prioritas", color: C.alert, fontWeight: 700, fontSize: 11 },
        data: [[{ xAxis: 60, yAxis: 50 }, { xAxis: 90, yAxis: 100 }]] },
    }],
  };

  const an = [...anom.data].sort((a, b) => b["di_musim_asap_%"] - a["di_musim_asap_%"]);
  const anOpt: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: any) => `${fmt(v, 0)}%` },
    grid: { left: 8, right: 14, top: 10, bottom: 10 },
    xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" } },
    yAxis: { type: "category", data: an.map((r) => byCode[r.code].nama), inverse: true, axisLabel: { fontSize: 11 } },
    series: [{ type: "bar", data: an.map((r) => ({ value: r["di_musim_asap_%"], itemStyle: { color: byCode[r.code].gambut ? C.gambut : C.otherSoft } })),
      markLine: { silent: true, symbol: "none", lineStyle: { type: "dashed" }, label: { formatter: "34%", fontSize: 11 }, data: [{ xAxis: 34 }] } }],
  };

  const cov = [...d[0]].filter((r) => filt(r.code)).sort((x, y) => x["hari_valid_%"] - y["hari_valid_%"]);
  const covOpt: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: any) => { const r = cov[ps[0].dataIndex]; return `<b>${byCode[r.code].nama}</b> (${r.code}) · grade ${r.grade}<br/>${fmt(r["hari_valid_%"], 1)}% hari valid · ${KAT_LAB[r.kategori]}<br/>${r.masalah}`; } },
    legend: { top: 0, data: ["Andal", "Diakui metadata", "Tersembunyi"] },
    grid: { left: 8, right: 64, top: 30, bottom: 20 },
    xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" } },
    yAxis: { type: "category", inverse: true, data: cov.map((r) => byCode[r.code].nama), axisLabel: { fontSize: 11.5, color: C.ink }, axisTick: { show: false } },
    series: Object.entries(KAT_LAB).map(([k, lab]) => ({
      name: lab, type: "bar" as const, stack: "a", barWidth: 12, itemStyle: { color: KAT_COL[k], borderRadius: [0, 4, 4, 0] },
      data: cov.map((r) => (r.kategori === k ? { value: r["hari_valid_%"], code: r.code } : null)),
      label: { show: true, position: "right" as const, formatter: (p: any) => (p.value == null ? "" : `${fmt(p.value, 0)}% · ${cov[p.dataIndex].grade}`), fontSize: 11, color: C.inkSoft },
    })),
  };
  const kat = (k: string) => d[0].filter((r) => r.kategori === k).length;
  const beku = Math.max(...d[0].map((r) => r.baris_sensor_beku ?? 0));

  return (
    <Page path="/jaringan"
      headline={`${d[0].length - Number(kat("Andal"))} dari ${d[0].length} stasiun tidak bisa dipercaya penuh, dan Kalimantan paling buta`}
      kpis={<>
        <Kpi k="Stasiun andal" v={kat("Andal")} unit={`dari ${d[0].length}`} note="grade A–B, tanpa masalah" />
        <Kpi k="Bermasalah tersembunyi" v={kat("TERSEMBUNYI (status Active)")} unit="stasiun" note="status Active, data cacat" />
        <Kpi k="Jam sensor beku berlabel VALID" v={fmt(beku, 0)} unit="jam" note="Banjarbaru (BJB-01), ±10 bulan" />
      </>}
      main={
        <Card title="Di mana titik pantau baru paling dibutuhkan" sub="Urutan dari risiko polusi, pemburukan, keandalan data, dan stasiun kembar">
          <ol className="prio">
            {PRIO.map((r, k) => (
              <li key={r.w}>
                <span className="n">{k + 1}</span>
                <div><b>{r.w}</b><p>{r.why}</p></div>
                <span className="act">{r.act}</span>
              </li>
            ))}
          </ol>
        </Card>
      }
      method="Grade: A ≥95% hari valid & imputasi <5% · B ≥90% · C ≥75% · D ≥25% · E <25%. 'Tersembunyi' = status Active tapi grade C–E atau ada sensor beku. Skor risiko = gabungan rata-rata, persentil 95, dan tren PM2.5. Anomali dari Isolation Forest per stasiun."
      supports={[
        <Card key="a" title="Polusi tinggi, data lemah" sub="Kotak merah = prioritas: risiko tinggi tapi datanya tidak andal">
          <Chart option={prioOpt} height={260} onClick={(p: any) => p.data?.code && openProfil(p.data.code)} />
        </Card>,
      ]}
      more={[
        <Card key="v" title="Hari dengan data valid per stasiun" sub="Warna = temuan pemeriksaan data; huruf = grade. Klik batang untuk profil stasiun.">
          <Chart option={covOpt} height={Math.max(420, cov.length * 21)} onClick={(p: any) => p.data?.code && openProfil(p.data.code)} ariaLabel="Cakupan data valid per stasiun" />
        </Card>,
        <Card key="c" title="Hari anomali yang jatuh di musim asap" sub={`Garis = porsi Jul–Okt dalam setahun (34%). Gambut: ${fmt(anom["gambut_di_musim_asap_%"], 0)}%.`}>
          <Chart option={anOpt} height={260} />
        </Card>,
      ]}
      extra={
        <details className="more">
          <summary>Rapor lengkap per stasiun</summary>
          <div style={{ marginTop: 8 }}>
        <Card title="Rapor kualitas data per stasiun" sub="Klik judul kolom untuk mengurutkan, klik baris untuk profil.">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>
                {th("code", "Stasiun")}{th("grade", "Grade")}{th("hari_valid_%", "Hari valid", true)}{th("imputasi_%", "Interpolasi", true)}{th("baris_sensor_beku", "Jam beku", true)}{th("kategori", "Temuan")}<th>Masalah</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className="click" onClick={() => openProfil(r.code)}>
                    <td style={{ minWidth: 130 }}><b style={{ color: pick(r.code) ?? undefined }}>{byCode[r.code].nama}</b><br /><span style={{ color: "var(--ink-soft)", fontSize: 11.5 }}>{r.code} · {byCode[r.code].provinsi}<br />status: {r.status_metadata}</span></td>
                    <td><span className="grade" style={{ background: GRADE_STYLE[r.grade].bg, color: GRADE_STYLE[r.grade].fg }}>{r.grade}</span></td>
                    <td className="num">{fmt(r["hari_valid_%"], 1)}%</td>
                    <td className="num">{fmt(r["imputasi_%"], 1)}%</td>
                    <td className="num">{r.baris_sensor_beku ? fmt(r.baris_sensor_beku, 0) : "–"}</td>
                    <td><span className="pill" style={r.kategori === "Andal" ? { background: "#eef0f1", color: C.inkSoft } : { background: KAT_COL[r.kategori], color: "#fff" }}>{KAT_LAB[r.kategori]}</span></td>
                    <td style={{ fontSize: 12, color: "var(--ink-soft)", minWidth: 110, maxWidth: 300 }}>{r.masalah}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
          </div>
        </details>
      }
    />
  );
}
