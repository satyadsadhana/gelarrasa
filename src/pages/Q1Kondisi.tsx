import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import Chart from "../components/Chart";
import { Card, Kpi, Page, Seg } from "../components/Layout";
import { useData } from "../lib/data";
import { fmt, fmtPct, UG } from "../lib/format";
import { useApp, usePick, usePickSymbol, useStationFilter } from "../lib/state";
import { C, GAMBUT_COL, MUTED, TIER, TIPE_COL } from "../lib/theme";
import type { Summary } from "../lib/types";

type Annual = { per_stasiun: { code: string; tahun: number; rata2: number; lengkap: boolean; lampaui_PP22: boolean }[]; tangga_who: Record<string, Record<string, number>>; urutan_tangga: string[] };
type Trend = { kelompok: Record<string, Record<string, number>>; kelompok_musim: { gambut: string; musim: string; [y: string]: number | string }[] };
type Iku = { data: { code: string; tahun: number; IKU: number; kategori_IKU: string; pm25: number }[]; buta_asap_2025: string[]; rho_2025: number };

/** Tangga WHO: makin gelap = makin jauh dari target. */
const TIER_COL = [TIER[5], TIER[4], TIER[3], TIER[2], TIER[1], TIER[0]];
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
      legend: { bottom: 0, data: tipes, itemGap: 10, textStyle: { fontSize: 11 } },
      grid: { left: 10, right: 30, top: 20, bottom: 74 },
      xAxis: { type: "log", name: `Rata-rata PM2.5 harian (${UG}) → beban kronis`, nameLocation: "middle", nameGap: 28, min: 5, max: 200 },
      yAxis: { type: "log", name: "Persentil 95 → keparahan episode", nameLocation: "middle", nameGap: 40, min: 10, max: 1000 },
      series: tipes.map((t) => ({
        name: t, type: "scatter", itemStyle: { color: TIPE_COL[t] },
        data: d[0].filter((s) => s.tipe === t).map((s) => {
          const ring = pick(s.code), on = filt(s.code);
          return {
            value: [s.rata2_pm25, s.p95_pm25], s, symbolSize: ring ? 18 : 12, symbol: sym(s.code) ?? "circle",
            itemStyle: { color: on ? TIPE_COL[t] : MUTED, borderColor: ring ?? "#fff", borderWidth: ring ? 3 : 1, opacity: on ? 1 : 0.4 },
            label: { show: !!ring || s.code === "SM2-01", formatter: byCode[s.code].nama, position: "right", fontSize: 12, fontWeight: 700, color: C.ink, textBorderColor: "#fff", textBorderWidth: 3 },
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

  if (!d || !quad) return <div className="loading">Memuat data kualitas udara…</div>;
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
      name: lamp ? "Melampaui 15 µg/m³" : "Memenuhi", type: "bar", stack: "a", itemStyle: { color: lamp ? TIER[4] : TIER[1] },
      label: { show: true, color: lamp ? "#fff" : C.ink, fontWeight: 700 }, barWidth: 26,
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

  // Peringkat rata-rata tahunan 2025 per stasiun (hanya tahun yang lengkap ≥75% hari).
  const rank = ann.per_stasiun.filter((r) => r.tahun === 2025 && r.lengkap).sort((a, b) => a.rata2 - b.rata2);
  const refLine = acuan === "who" ? 35 : 15;
  const rankOpt: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: any) => { const r = rank[ps[0].dataIndex]; return `<b>${byCode[r.code].nama}</b> · ${byCode[r.code].kelompok}<br/>Rata-rata 2025: <b>${fmt(r.rata2)}</b> ${UG}`; } },
    grid: { left: 8, right: 70, top: 26, bottom: 24 },
    xAxis: { type: "value", name: UG, nameLocation: "end" },
    yAxis: { type: "category", data: rank.map((r) => byCode[r.code].nama), axisLabel: { fontSize: 11.5, color: C.ink }, axisTick: { show: false } },
    series: [{
      type: "bar", barWidth: 12,
      data: rank.map((r) => {
        const on = filt(r.code), ring = pick(r.code);
        return { value: r.rata2, code: r.code, itemStyle: { color: !on ? MUTED : byCode[r.code].gambut ? C.gambut : C.other, borderRadius: [0, 4, 4, 0], borderColor: ring ?? undefined, borderWidth: ring ? 2 : 0 } };
      }),
      label: { show: true, position: "right", formatter: (p: any) => fmt(p.value), fontSize: 11, color: C.inkSoft },
      markLine: { silent: true, symbol: "none", lineStyle: { color: C.ink, type: "dashed", width: 1.5 },
        label: { formatter: acuan === "who" ? "WHO IT-1 · 35" : "Baku mutu tahunan · 15", position: "end", color: C.ink, fontSize: 11, fontWeight: 600 },
        data: [{ xAxis: refLine }] },
    }],
  };
  const above = rank.filter((r) => r.rata2 > refLine).length;
  const blindN = iku.buta_asap_2025.length;
  const tg = trend.kelompok;
  const pct = (g: string) => (tg[g]["2026"] / tg[g]["2024"] - 1) * 100;

  return (
    <Page path="/kondisi"
      kpis={<>
        <Kpi k="Stasiun melampaui baku mutu tahunan" v={`${fmt(ann.per_stasiun.filter((r) => r.tahun === 2025 && r.lengkap && r.lampaui_PP22).length, 0)} dari ${rank.length}`} note={`2025 · batas 15 ${UG}`} />
        <Kpi k="Belum capai target WHO IT-1 (35)" v={`${ann.tangga_who["2024"][ann.urutan_tangga[0]]} → ${ann.tangga_who["2025"][ann.urutan_tangga[0]]}`} unit="stasiun" note="2024 → 2025" />
        <Kpi k="Perubahan PM2.5 kawasan gambut" v={fmtPct(pct("Gambut"), 0, true)} note={`non-gambut ${fmtPct(pct("Non-gambut"), 0, true)} · 1 Jan–14 Okt, 2024 → 2026`} />
        <Kpi k={'IKU "Baik" padahal PM2.5 > 35'} v={fmt(blindN, 0)} unit="stasiun" note="IKU hanya dihitung dari NO₂ & SO₂" />
      </>}
      main={
        <Card title={`Rata-rata PM2.5 per stasiun, 2025`} sub={`Oranye = kawasan gambut, abu = lainnya. ${above} dari ${rank.length} stasiun di kanan garis ${acuan === "who" ? "WHO IT-1" : "baku mutu"}. Ganti acuan di bar atas.`}>
          <Chart option={rankOpt} height={Math.max(420, rank.length * 22)} onClick={(p: any) => p.data?.code && openProfil(p.data.code)} ariaLabel="Peringkat rata-rata PM2.5 per stasiun" />
        </Card>
      }
      method="Rata-rata tahunan hanya sah bila ≥75% hari punya data. Tren memakai periode 1 Jan–14 Okt tiap tahun (BJB-01 & MER-01 dikeluarkan karena cakupan <75%). IKU dihitung ulang dari NO₂ & SO₂ sesuai Permen LHK 27/2021."
      supports={[
        <Card key="q" title="Rata-rata dan lonjakan per stasiun" sub="Skala log. Warna = tipe pola waktu: oranye episodik (asap musiman), slate kronis.">
          <Chart option={quad} height={340} onClick={(p: any) => p.data?.s && openProfil(p.data.s.code)} ariaLabel="Rata-rata vs persentil 95" />
        </Card>,
        <Card key="b" title="PM2.5 per kelompok kawasan, 1 Jan–14 Okt" sub="Persentase di ujung garis = perubahan 2024 → 2026"
          right={<Seg value={musim} onChange={setMusim} options={[["semua", "Semua"], ["Jan–Jun", "Luar musim"], ["Jul–14 Okt", "Musim asap"]]} />}>
          <Chart option={trendOpt} height={300} />
        </Card>,
        <Card key="a" title={acuan === "who" ? "Stasiun menurut target antara WHO" : "Stasiun terhadap baku mutu tahunan"}
          sub={acuan === "who" ? "Makin gelap = makin jauh dari target 5 µg/m³" : "PP 22/2021 · 15 µg/m³ · stasiun dengan data ≥75% hari"}>
          <Chart option={ladder} height={220} />
        </Card>,
        <Card key="c" title="IKU 2025 dibandingkan PM2.5" sub={`Titik slate = IKU "Baik" tetapi PM2.5 tahunan > 35 ${UG}`}>
          <Chart option={ikuOpt} height={220} />
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
