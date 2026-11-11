import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import Chart from "../components/Chart";
import { Card, Page, Seg } from "../components/Layout";
import { useData } from "../lib/data";
import { fmt, fmtPct, UG } from "../lib/format";
import { useApp, usePick, usePickSymbol, useStationFilter } from "../lib/state";
import { C, GAMBUT_COL, MUTED, RAMP, TIPE_COL } from "../lib/theme";
import type { Summary } from "../lib/types";

type Annual = { per_stasiun: { code: string; tahun: number; rata2: number; lengkap: boolean; lampaui_PP22: boolean }[]; tangga_who: Record<string, Record<string, number>>; urutan_tangga: string[] };
type Trend = { kelompok: Record<string, Record<string, number>>; kelompok_musim: { gambut: string; musim: string; [y: string]: number | string }[] };
type Iku = { data: { code: string; tahun: number; IKU: number; kategori_IKU: string; pm25: number }[]; buta_asap_2025: string[]; rho_2025: number };

/** Tangga WHO: makin gelap = makin jauh dari target. */
const TIER_COL = [RAMP[5], RAMP[4], RAMP[3], RAMP[2], RAMP[1], RAMP[0]];
const TIER_ON = ["#fff", "#fff", "#fff", C.ink, C.ink, C.ink];

export default function Q1Kondisi() {
  const d = useData<[Summary[], Annual, Trend, Iku]>("station_summary", "annual", "trend", "iku");
  const { acuan, byCode, openProfil } = useApp();
  const pick = usePick();
  const sym = usePickSymbol();
  const filt = useStationFilter();
  const [musim, setMusim] = useState<"semua" | "Jan–Jun" | "Jul–14 Okt">("semua");

  const quad = useMemo<EChartsOption | null>(() => {
    if (!d) return null;
    const ref = acuan === "who" ? 35 : 15;
    const tipes = Object.keys(TIPE_COL);
    return {
      tooltip: { formatter: (p: any) => p.data?.s ? `<b>${byCode[p.data.s.code].nama}</b> (${p.data.s.code})<br/>${p.data.s.tipe}<br/>Rata-rata: <b>${fmt(p.value[0])}</b> ${UG}<br/>Persentil 95: <b>${fmt(p.value[1])}</b> ${UG}` : "" },
      legend: { bottom: 0, data: tipes },
      grid: { left: 10, right: 30, top: 20, bottom: 40 },
      xAxis: { type: "log", name: `Rata-rata PM2.5 harian (${UG}) → beban kronis`, nameLocation: "middle", nameGap: 28, min: 5, max: 200 },
      yAxis: { type: "log", name: "Persentil 95 → keparahan episode", nameLocation: "middle", nameGap: 40, min: 10, max: 1000 },
      series: tipes.map((t) => ({
        name: t, type: "scatter", itemStyle: { color: TIPE_COL[t] },
        data: d[0].filter((s) => s.tipe === t).map((s) => {
          const ring = pick(s.code), on = filt(s.code);
          return {
            value: [s.rata2_pm25, s.p95_pm25], s, symbolSize: ring ? 18 : 12, symbol: sym(s.code) ?? "circle",
            itemStyle: { color: on ? TIPE_COL[t] : MUTED, borderColor: ring ?? "#fff", borderWidth: ring ? 3 : 1, opacity: on ? 1 : 0.4 },
            label: { show: !!ring || s.code === "SM2-01", formatter: byCode[s.code].nama, position: "right", fontSize: 12, fontWeight: 700, color: ring ?? C.ink, textBorderColor: "#fff", textBorderWidth: 3 },
          };
        }),
        markLine: t === tipes[0] ? {
          silent: true, symbol: "none", lineStyle: { color: C.inkSoft, type: "dashed" },
          label: { formatter: acuan === "who" ? "WHO IT-1 = 35" : "Baku mutu tahunan = 15", position: "end", color: C.inkSoft, fontSize: 11 },
          data: [{ xAxis: ref }],
        } : undefined,
      })),
    };
  }, [d, acuan, pick, filt, byCode]);

  if (!d || !quad) return <div className="loading">Memuat…</div>;
  const [summ, ann, trend, iku] = d;
  const yrs = ["2024", "2025"];

  const ladder: EChartsOption = acuan === "who" ? {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0, itemWidth: 10, textStyle: { fontSize: 10.5 } },
    grid: { left: 8, right: 10, top: 6, bottom: 64 },
    xAxis: { type: "value", max: 24, name: "stasiun" }, yAxis: { type: "category", data: yrs, inverse: true },
    series: ann.urutan_tangga.map((t, i) => ({
      name: t, type: "bar", stack: "a", itemStyle: { color: TIER_COL[i] },
      label: { show: true, color: TIER_ON[i], fontWeight: 700, formatter: (p: any) => (p.value ? p.value : "") },
      data: yrs.map((y) => ann.tangga_who[y][t] ?? 0),
    })),
  } : {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0 }, grid: { left: 8, right: 10, top: 6, bottom: 40 },
    xAxis: { type: "value", max: 24 }, yAxis: { type: "category", data: yrs, inverse: true },
    series: [true, false].map((lamp) => ({
      name: lamp ? "Melampaui 15 µg/m³" : "Memenuhi", type: "bar", stack: "a", itemStyle: { color: lamp ? RAMP[4] : RAMP[1] },
      label: { show: true, color: lamp ? "#fff" : C.ink, fontWeight: 700 },
      data: yrs.map((y) => ann.per_stasiun.filter((r) => String(r.tahun) === y && r.lengkap && r.lampaui_PP22 === lamp).length),
    })),
  };

  const groups = ["Gambut", "Non-gambut"];
  const trendOpt: EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (v: any) => `${fmt(v)} ${UG}` },
    legend: { bottom: 0 }, grid: { left: 8, right: 54, top: 14, bottom: 34 },
    xAxis: { type: "category", data: ["2024", "2025", "2026"] }, yAxis: { type: "value", name: UG },
    series: groups.map((g) => {
      const vals = musim === "semua" ? ["2024", "2025", "2026"].map((y) => trend.kelompok[g][y])
        : ["2024", "2025", "2026"].map((y) => trend.kelompok_musim.find((r) => r.gambut === g && r.musim === musim)![y] as number);
      const ch = (vals[2] / vals[0] - 1) * 100;
      return {
        name: g, type: "line", data: vals, symbolSize: 8, lineStyle: { width: 3 }, itemStyle: { color: GAMBUT_COL[g as "Gambut"] },
        endLabel: { show: true, formatter: fmtPct(ch, 0, true), fontWeight: 700 },
      };
    }),
  };

  const iku25 = iku.data.filter((r) => r.tahun === 2025);
  const ikuOpt: EChartsOption = {
    tooltip: { formatter: (p: any) => `<b>${byCode[p.data.code].nama}</b><br/>IKU ${fmt(p.value[0])} (${p.data.kat})<br/>PM2.5 ${fmt(p.value[1])} ${UG}` },
    grid: { left: 8, right: 14, top: 14, bottom: 30 },
    xAxis: { type: "value", name: "IKU 2025 (NO₂ & SO₂)", nameLocation: "middle", nameGap: 24, min: 0, max: 100 },
    yAxis: { type: "value", name: `PM2.5 2025 (${UG})` },
    series: [{
      type: "scatter", symbolSize: 11,
      data: iku25.map((r) => {
        const blind = iku.buta_asap_2025.includes(r.code);
        return { value: [r.IKU, r.pm25], code: r.code, kat: r.kategori_IKU, symbol: sym(r.code) ?? "circle",
          itemStyle: { color: !filt(r.code) ? MUTED : blind ? C.focus : C.other, borderColor: pick(r.code) ?? "#fff", borderWidth: pick(r.code) ? 3 : 1 } };
      }),
      markLine: { silent: true, symbol: "none", lineStyle: { type: "dashed", color: C.inkSoft }, label: { formatter: "35 (WHO IT-1)", position: "insideStartTop" }, data: [{ yAxis: 35 }] },
      markArea: { silent: true, itemStyle: { color: "rgba(52,64,76,0.07)" }, label: { show: true, formatter: 'IKU "Baik", PM2.5 > 35', position: "insideTopLeft", color: C.focus, fontWeight: 700, fontSize: 11 }, data: [[{ xAxis: 70, yAxis: 35 }, { xAxis: 100, yAxis: 400 }]] },
    }],
  };

  return (
    <Page path="/kondisi"
      answer="Hampir semua wilayah melampaui baku mutu tahunan, dan pemburukan terjadi hampir seluruhnya di kawasan gambut."
      main={
        <Card title="Rata-rata bisa mirip, perilakunya berbeda" sub="Tiap titik = satu stasiun (skala log). Warna = tipe hasil clustering pola waktu (M1). Klik titik untuk profil.">
          <Chart option={quad} height={420} onClick={(p: any) => p.data?.s && openProfil(p.data.s.code)} ariaLabel="Kuadran kronis vs episodik" />
        </Card>
      }
      means={[
        <><b>21 dari 24</b> stasiun melampaui baku mutu tahunan 15 {UG} (2024 & 2025).</>,
        <>PM2.5 adalah pencemar kritis di <b>99,6%</b> hari; gas tidak pernah melewati kategori Sedang.</>,
        <>Pemburukan gambut terjadi saat musim asap; <b>Samarinda</b> pengecualian: memburuk di luar musim asap (+61%).</>,
      ]}
      method="Rata-rata tahunan hanya sah bila ≥75% hari punya data. Tren memakai periode 1 Jan–14 Okt tiap tahun (BJB-01 & MER-01 dikeluarkan karena cakupan <75%)."
      supports={[
        <Card key="a" title={acuan === "who" ? "Gagal target WHO paling longgar: 12 → 16" : "Melampaui baku mutu tahunan: 21 dari 24"}
          sub={acuan === "who" ? "Tangga target antara WHO 2021 (IT-1 = 35 µg/m³)" : "PP 22/2021: PM2.5 tahunan 15 µg/m³ · ganti Acuan ke WHO di atas"}>
          <Chart option={ladder} height={230} />
        </Card>,
        <Card key="b" title="Gambut +102%, non-gambut +3%" sub="Rata-rata PM2.5 1 Jan–14 Okt per kelompok"
          right={<Seg value={musim} onChange={setMusim} options={[["semua", "Semua"], ["Jan–Jun", "Luar musim"], ["Jul–14 Okt", "Musim asap"]]} />}>
          <Chart option={trendOpt} height={230} />
        </Card>,
        <Card key="c" title="IKU resmi tidak melihat asap" sub={`${iku.buta_asap_2025.length} stasiun ber-IKU "Baik" padahal PM2.5 > 35 (titik gelap)`}
          note="IKU (Permen LHK 27/2021) hanya dihitung dari NO₂ & SO₂.">
          <Chart option={ikuOpt} height={230} />
        </Card>,
      ]}
      extra={
        <details className="more">
          <summary>Lihat perubahan per stasiun (1 Jan–14 Okt, 2024 → 2026)</summary>
          <div className="card" style={{ marginTop: 8 }}>
            <Chart height={560} option={{
              tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: any) => fmtPct(v, 1, true) },
              grid: { left: 8, right: 30, top: 10, bottom: 20 },
              xAxis: { type: "value", name: "%" },
              yAxis: { type: "category", data: [...summ].filter((s) => s["ubah_%"] != null && !byCode[s.code].excl_tren).sort((a, b) => a["ubah_%"]! - b["ubah_%"]!).map((s) => byCode[s.code].nama) },
              series: [{ type: "bar", data: [...summ].filter((s) => s["ubah_%"] != null && !byCode[s.code].excl_tren).sort((a, b) => a["ubah_%"]! - b["ubah_%"]!).map((s) => ({ value: s["ubah_%"], itemStyle: { color: byCode[s.code].gambut ? GAMBUT_COL.Gambut : GAMBUT_COL["Non-gambut"] } })) }],
            }} />
          </div>
        </details>
      }
    />
  );
}
