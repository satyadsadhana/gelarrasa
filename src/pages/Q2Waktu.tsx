import { useState } from "react";
import type { EChartsOption } from "echarts";
import Chart from "../components/Chart";
import TimeSeries from "../components/TimeSeries";
import { Card, Kpi, Page, Seg } from "../components/Layout";
import { useData } from "../lib/data";
import { BULAN, fmt, fmtDate, UG } from "../lib/format";
import { useApp } from "../lib/state";
import { C, YEAR_COL } from "../lib/theme";
import type { Daily, StationsFile } from "../lib/types";

type Monthly = { bulan: string[]; gambut: (number | null)[]; non_gambut: (number | null)[] };
type Cal = { tahun: number[]; minggu: number[]; pct_tidak_sehat: (number | null)[][]; minggu_awal: Record<string, number> };
type Diurnal = { jam: number[]; kelompok_pm25_rel: Record<string, number[]>; o3_rel: number[]; no2_rel: number[] };
type Eps = { per_tahun: { tahun: number; jumlah_episode: number; total_hari: number; terpanjang: number }[]; episode: { code: string; mulai: string; selesai: string; hari: number; puncak: number }[] };


export default function Q2Waktu() {
  const d = useData<[Daily, StationsFile, Monthly, Cal, Diurnal, Eps]>("daily", "stations", "monthly", "risk_calendar", "diurnal", "episodes");
  const { byCode } = useApp();
  const [pol, setPol] = useState<"pm25" | "gas">("pm25");

  if (!d) return <div className="loading">Memuat data harian dan musiman…</div>;
  const [daily, , mon, cal, diu, eps] = d;

  const seasonal: EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (v: any) => `${fmt(v)} ${UG}` },
    legend: { bottom: 0, textStyle: { fontSize: 11 } }, grid: { left: 8, right: 12, top: 14, bottom: 46 },
    xAxis: { type: "category", data: BULAN }, yAxis: { type: "value", name: UG },
    series: [
      ...["2024", "2025", "2026"].map((y) => ({
        name: `Gambut ${y}${y === "2026" ? " (Okt s.d. 14)" : ""}`, type: "line" as const, smooth: true, symbolSize: 5,
        lineStyle: { width: y === "2026" ? 3 : 2 }, itemStyle: { color: YEAR_COL[y] },
        markPoint: { symbol: "circle", symbolSize: 7, label: { show: true, position: "top" as const, formatter: (q: any) => fmt(q.value, 0), color: C.ink, fontSize: 11, fontWeight: 600 }, data: [{ type: "max" as const }] } as any,
        data: BULAN.map((_, m) => mon.gambut[mon.bulan.indexOf(`${y}-${String(m + 1).padStart(2, "0")}`)] ?? null),
      })),
      { name: "Non-gambut (rata-rata 3 tahun)", type: "line", lineStyle: { type: "dashed", width: 2 }, itemStyle: { color: C.other }, symbol: "none",
        data: BULAN.map((_, m) => { const v = mon.non_gambut.filter((_, i) => Number(mon.bulan[i].slice(5)) === m + 1).filter((x): x is number => x != null); return v.reduce((a, b) => a + b, 0) / v.length; }) },
    ],
  };

  const calOpt: EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (v: any) => (v == null ? "–" : `${fmt(v, 0)}% hari-stasiun`) },
    legend: { bottom: 0 }, grid: { left: 8, right: 14, top: 22, bottom: 40 },
    xAxis: { type: "category", data: cal.minggu.map(String), name: "minggu ke-", nameLocation: "middle", nameGap: 24, axisLabel: { interval: 3, fontSize: 10.5 } },
    yAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" } },
    series: cal.tahun.map((y, yi) => ({
      name: String(y), type: "line" as const, symbol: "none", smooth: true, data: cal.pct_tidak_sehat[yi],
      lineStyle: { width: y === 2026 ? 2.5 : 2 }, itemStyle: { color: YEAR_COL[String(y)] },
      markLine: yi === 0 ? { silent: true, symbol: "none", lineStyle: { color: C.ink, type: "dashed" as const }, label: { formatter: "mg 31 · akhir Juli", color: C.ink, fontSize: 10.5, position: "insideEndTop" as const }, data: [{ xAxis: "31" }] } : undefined,
    })),
  };

  const kel = Object.keys(diu.kelompok_pm25_rel);
  const diuOpt: EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (v: any) => `${fmt(v, 2)}×` },
    legend: { bottom: 0, textStyle: { fontSize: 10.5 }, itemWidth: 12 }, grid: { left: 8, right: 10, top: 14, bottom: 52 },
    xAxis: { type: "category", data: diu.jam.map((h) => String(h).padStart(2, "0")), name: "jam lokal", nameLocation: "middle", nameGap: 22 },
    yAxis: { type: "value", name: "× rata-rata harian", min: (v: any) => Math.floor(v.min * 10) / 10 },
    series: pol === "pm25"
      ? kel.map((k) => {
          const key = k === "Gambut" || k === "Roadside";
          return { name: k, type: "line" as const, symbol: "none", smooth: true, data: diu.kelompok_pm25_rel[k], z: key ? 3 : 1,
            itemStyle: { color: k === "Gambut" ? C.gambut : k === "Roadside" ? C.focus : C.otherSoft }, lineStyle: { width: key ? 2.5 : 1.5 },
            emphasis: { focus: "series" as const } };
        })
      : [{ name: "O₃", type: "line", symbol: "none", smooth: true, data: diu.o3_rel, itemStyle: { color: C.focus }, lineStyle: { width: 3 } },
         { name: "NO₂", type: "line", symbol: "none", smooth: true, data: diu.no2_rel, itemStyle: { color: C.other }, lineStyle: { width: 2.5, type: "dashed" } }],
  };

  // Hari episode asap berat hanya di stasiun kawasan gambut (sama dengan laporan; Samarinda kawasan industri dipisah).
  const gambutHari = (y: number) => eps.episode.filter((e) => byCode[e.code]?.gambut && Number(e.mulai.slice(0, 4)) === y).reduce((a, e) => a + e.hari, 0);
  const peak = (y: string) => Math.max(...mon.bulan.map((b, k) => (b.startsWith(y) ? mon.gambut[k] ?? 0 : 0)));
  const longest = eps.episode.filter((e) => byCode[e.code]?.gambut).sort((a, b) => b.hari - a.hari)[0];

  return (
    <Page path="/waktu"
      kpis={<>
        <Kpi k="Puncak bulanan kawasan gambut" v={`${fmt(peak("2024"), 0)} → ${fmt(peak("2025"), 0)} → ${fmt(peak("2026"), 0)}`} unit={UG} note="2024 → 2025 → 2026" />
        <Kpi k="Hari asap berat di kawasan gambut" v={`${gambutHari(2024)} → ${gambutHari(2025)} → ${gambutHari(2026)}`} unit="hari" note={`episode ≥3 hari > 150 ${UG}`} />
        <Kpi k="Episode terpanjang" v={`${longest.hari} hari`} note={`${byCode[longest.code].nama}, ${fmtDate(longest.mulai)} – ${fmtDate(longest.selesai)}`} />
        <Kpi k="Musim risiko dimulai" v={`minggu ke-${Math.min(...Object.values(cal.minggu_awal))}`} note={`akhir Juli · ${Object.entries(cal.minggu_awal).map(([y, w]) => `${y}: mg ${w}`).join(" · ")}`} />
      </>}
      main={<TimeSeries daily={daily} />}
      method="Titik harian sah bila ≥18 jam valid; mingguan bila ≥4 hari valid; bulanan bila ≥15 hari valid. Garis putus = data tidak valid. Episode asap berat = ≥3 hari berturut-turut PM2.5 harian > 150,4 µg/m³; angka di atas hanya stasiun kawasan gambut (Samarinda, kawasan industri, dihitung terpisah). Selisih hari kerja dan akhir pekan: median 0,03%."
      supports={[
        <Card key="a" title="Rata-rata bulanan kawasan gambut" sub="Tiga tahun ditumpuk; angka = puncak tiap tahun">
          <Chart option={seasonal} height={260} />
        </Card>,
        <Card key="b" title="Hari tidak sehat di kawasan gambut per minggu" sub={`% hari-stasiun gambut dengan PM2.5 > 55,4 ${UG}`}>
          <Chart option={calOpt} height={260} />
        </Card>,
        <Card key="c" title="Pola jam" sub="Relatif terhadap rata-rata harian (1 = rata-rata)"
          right={<Seg value={pol} onChange={setPol} options={[["pm25", "PM2.5"], ["gas", "O₃ & NO₂"]]} />}>
          <Chart option={diuOpt} height={260} />
        </Card>,
      ]}
    />
  );
}
