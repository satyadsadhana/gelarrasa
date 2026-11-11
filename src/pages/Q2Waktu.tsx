import { useState } from "react";
import type { EChartsOption } from "echarts";
import Chart from "../components/Chart";
import TimeSeries from "../components/TimeSeries";
import { Card, Page, Seg } from "../components/Layout";
import { useData } from "../lib/data";
import { BULAN, fmt, fmtDate, UG } from "../lib/format";
import { useApp } from "../lib/state";
import { C, RAMP, YEAR_COL } from "../lib/theme";
import type { Daily, StationsFile } from "../lib/types";

type Monthly = { bulan: string[]; gambut: (number | null)[]; non_gambut: (number | null)[] };
type Cal = { tahun: number[]; minggu: number[]; pct_tidak_sehat: (number | null)[][]; minggu_awal: Record<string, number> };
type Diurnal = { jam: number[]; kelompok_pm25_rel: Record<string, number[]>; o3_rel: number[]; no2_rel: number[] };
type Eps = { per_tahun: { tahun: number; jumlah_episode: number; total_hari: number; terpanjang: number }[]; episode: { code: string; mulai: string; selesai: string; hari: number; puncak: number }[] };


export default function Q2Waktu() {
  const d = useData<[Daily, StationsFile, Monthly, Cal, Diurnal, Eps]>("daily", "stations", "monthly", "risk_calendar", "diurnal", "episodes");
  const { byCode } = useApp();
  const [pol, setPol] = useState<"pm25" | "gas">("pm25");

  if (!d) return <div className="loading">Memuat…</div>;
  const [daily, , mon, cal, diu, eps] = d;

  const seasonal: EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (v: any) => `${fmt(v)} ${UG}` },
    legend: { bottom: 0, textStyle: { fontSize: 11 } }, grid: { left: 8, right: 12, top: 14, bottom: 46 },
    xAxis: { type: "category", data: BULAN }, yAxis: { type: "value", name: UG },
    series: [
      ...["2024", "2025", "2026"].map((y) => ({
        name: `Gambut ${y}${y === "2026" ? " (Okt s.d. 14)" : ""}`, type: "line" as const, smooth: true, symbolSize: 5,
        lineStyle: { width: y === "2026" ? 3.5 : 2.2 }, itemStyle: { color: YEAR_COL[y] },
        data: BULAN.map((_, m) => mon.gambut[mon.bulan.indexOf(`${y}-${String(m + 1).padStart(2, "0")}`)] ?? null),
      })),
      { name: "Non-gambut (rata-rata 3 tahun)", type: "line", lineStyle: { type: "dashed", width: 2 }, itemStyle: { color: C.other }, symbol: "none",
        data: BULAN.map((_, m) => { const v = mon.non_gambut.filter((_, i) => Number(mon.bulan[i].slice(5)) === m + 1).filter((x): x is number => x != null); return v.reduce((a, b) => a + b, 0) / v.length; }) },
    ],
  };

  const calData: [number, number, number | null][] = [];
  cal.pct_tidak_sehat.forEach((r, yi) => r.forEach((v, wi) => calData.push([wi, yi, v])));
  const calOpt: EChartsOption = {
    tooltip: { formatter: (q: any) => `${cal.tahun[q.value[1]]}, minggu ke-${cal.minggu[q.value[0]]}<br/><b>${fmt(q.value[2], 0)}%</b> hari-stasiun gambut > 55,4 ${UG}` },
    grid: { left: 8, right: 10, top: 6, bottom: 56 },
    xAxis: { type: "category", data: cal.minggu.map(String), name: "minggu ke-", nameLocation: "middle", nameGap: 22, axisLabel: { interval: 3, fontSize: 10 } },
    yAxis: { type: "category", data: cal.tahun.map(String) },
    visualMap: { min: 0, max: 100, orient: "horizontal", left: "center", bottom: 0, itemHeight: 120, itemWidth: 10, text: ["100%", "0%"], inRange: { color: RAMP }, textStyle: { fontSize: 11, color: C.inkSoft } },
    series: [{
      type: "heatmap", data: calData,
      markLine: { symbol: "none", silent: true, lineStyle: { color: C.pick, width: 1.5 }, label: { formatter: "mg 31", fontSize: 11, color: C.pick, fontWeight: 700 }, data: [{ xAxis: "31" }] },
    }],
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

  return (
    <Page path="/waktu"
      answer="Kawasan gambut melonjak tiap Agustus–Oktober, dan musim asapnya makin panjang dan pekat tiap tahun; kota padat tinggi sepanjang tahun."
      main={<TimeSeries daily={daily} />}
      means={[
        <>Hari asap berat (episode ≥3 hari &gt; 150 {UG}): <b>{eps.per_tahun.map((r) => r.total_hari).join(" → ")} hari</b> (2024 → 2026).</>,
        <>Episode terpanjang: <b>{eps.episode[0].hari} hari</b> di {byCode[eps.episode[0].code].nama} ({fmtDate(eps.episode[0].mulai)} – {fmtDate(eps.episode[0].selesai)}), masih berlangsung saat data berakhir.</>,
        <>Akhir pekan tidak berbeda dari hari kerja (median selisih 0,03%).</>,
      ]}
      method="Titik harian sah bila ≥18 jam valid; titik mingguan bila ≥4 hari valid; titik bulanan bila ≥15 hari valid. Garis putus = data tidak valid. Rata-rata semua stasiun tanpa JMB-02 & MER-01."
      supports={[
        <Card key="a" title={`Puncak gambut: 70 → 108 → 336 ${UG}`} sub="Rata-rata bulanan kawasan gambut, tiga tahun ditumpuk">
          <Chart option={seasonal} height={250} />
        </Card>,
        <Card key="b" title="Siaga mulai akhir Juli" sub={`Minggu pertama ≥50% hari tidak sehat: ${Object.entries(cal.minggu_awal).map(([y, w]) => `${y}: mg ${w}`).join(" · ")}`}>
          <Chart option={calOpt} height={250} />
        </Card>,
        <Card key="c" title="Puncak pagi 07–08 & sore 17–19; ozon memuncak siang" sub="Profil jam lokal, relatif terhadap rata-rata harian"
          right={<Seg value={pol} onChange={setPol} options={[["pm25", "PM2.5"], ["gas", "O₃ & NO₂"]]} />}>
          <Chart option={diuOpt} height={250} />
        </Card>,
      ]}
    />
  );
}
