import { useState } from "react";
import type { EChartsOption } from "echarts";
import Chart from "../components/Chart";
import TimeSeries from "../components/TimeSeries";
import { Card, Kpi, Page, Seg, Story } from "../components/Layout";
import { BarsViz, WeeksViz } from "../components/Viz";
import { useData } from "../lib/data";
import { BULAN, fmt, fmtDate, UG } from "../lib/format";
import { useApp } from "../lib/state";
import { C, RAMP, YEAR_COL } from "../lib/theme";
import type { Daily, StationsFile } from "../lib/types";

type Monthly = { bulan: string[]; gambut: (number | null)[]; non_gambut: (number | null)[] };
type Cal = { tahun: number[]; minggu: number[]; pct_tidak_sehat: (number | null)[][]; minggu_awal: Record<string, number> };
type Diurnal = { jam: number[]; kelompok_pm25_rel: Record<string, number[]>; o3_rel: number[]; no2_rel: number[] };
type Eps = { per_tahun: { tahun: number; jumlah_episode: number; total_hari: number; terpanjang: number }[]; episode: { code: string; mulai: string; selesai: string; hari: number; puncak: number }[] };

/** Minggu ke- (1–52) dari tanggal ISO. */
const weekOf = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z"), y0 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.min(52, Math.floor((d.getTime() - y0) / 6048e5) + 1);
};

export default function Q2Waktu() {
  const d = useData<[Daily, StationsFile, Monthly, Cal, Diurnal, Eps]>("daily", "stations", "monthly", "risk_calendar", "diurnal", "episodes");
  const { byCode } = useApp();
  const [pol, setPol] = useState<"pm25" | "gas">("pm25");

  if (!d) return <div className="loading">Memuat data harian dan musiman…</div>;
  const [daily, , mon, cal, diu, eps] = d;

  const seasonal: EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (v: any) => (v == null ? "–" : `${fmt(v)} ${UG}`) },
    legend: { bottom: 0, textStyle: { fontSize: 11.5 } }, grid: { left: 8, right: 16, top: 30, bottom: 46 },
    xAxis: { type: "category", data: BULAN, axisLabel: { fontSize: 12, fontWeight: 600 } }, yAxis: { type: "value", name: UG },
    series: [
      ...["2024", "2025", "2026"].map((y, k) => ({
        name: `Gambut ${y}${y === "2026" ? " (Okt s.d. 14)" : ""}`, type: "line" as const, smooth: true, symbolSize: 6,
        lineStyle: { width: y === "2026" ? 4 : 2.4 }, itemStyle: { color: YEAR_COL[y] }, animationDuration: 1600, animationDelay: k * 500,
        areaStyle: y === "2026" ? { opacity: 0.1 } : undefined,
        markPoint: { symbol: "circle", symbolSize: 9, label: { show: true, position: "top" as const, formatter: (q: any) => fmt(q.value, 0), color: C.ink, fontSize: 12, fontWeight: 700 }, data: [{ type: "max" as const }] } as any,
        markArea: k === 0 ? { silent: true, itemStyle: { color: "rgba(212,98,42,0.08)" }, label: { show: true, position: "insideTop" as const, formatter: "Musim Asap", color: C.gambut, fontWeight: 700, fontSize: 12 }, data: [[{ xAxis: "Jul" }, { xAxis: "Okt" }]] } as any : undefined,
        data: BULAN.map((_, m) => mon.gambut[mon.bulan.indexOf(`${y}-${String(m + 1).padStart(2, "0")}`)] ?? null),
      })),
      { name: "Kawasan lain (rata-rata 3 tahun)", type: "line", lineStyle: { type: "dashed", width: 2 }, itemStyle: { color: C.other }, symbol: "none",
        data: BULAN.map((_, m) => { const v = mon.non_gambut.filter((_, i) => Number(mon.bulan[i].slice(5)) === m + 1).filter((x): x is number => x != null); return v.reduce((a, b) => a + b, 0) / v.length; }) },
    ],
  };

  // Kalender risiko: baris = tahun, kolom = minggu, warna = % hari-stasiun gambut tidak sehat.
  const heat: [number, number, number | null][] = [];
  cal.tahun.forEach((_, yi) => cal.minggu.forEach((_w, wi) => heat.push([wi, yi, cal.pct_tidak_sehat[yi][wi]])));
  const calOpt: EChartsOption = {
    tooltip: { formatter: (p: any) => `${cal.tahun[p.value[1]]}, minggu ke-${cal.minggu[p.value[0]]}<br/><b>${p.value[2] == null ? "belum ada data" : `${fmt(p.value[2], 0)}%`}</b> hari-stasiun gambut tidak sehat` },
    grid: { left: 8, right: 8, top: 10, bottom: 62 },
    xAxis: { type: "category", data: cal.minggu.map(String), splitArea: { show: false }, axisTick: { show: false }, axisLine: { show: false },
      axisLabel: { interval: 3, fontSize: 10.5 }, name: "minggu ke-", nameLocation: "middle", nameGap: 22 },
    yAxis: { type: "category", data: cal.tahun.map(String), inverse: true, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { fontSize: 13, fontWeight: 700, color: C.ink } },
    visualMap: { min: 0, max: 100, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemWidth: 12, itemHeight: 180, text: ["100% tidak sehat", "0%"], textStyle: { fontSize: 11 },
      inRange: { color: ["#eef3f4", RAMP[1], RAMP[2], RAMP[3], RAMP[4], RAMP[5]] } },
    series: [{ type: "heatmap", data: heat.map(([x, y, v]) => [x, y, v ?? "-"]), itemStyle: { borderColor: "#fff", borderWidth: 2, borderRadius: 3 },
      emphasis: { itemStyle: { borderColor: C.ink, borderWidth: 2 } }, progressive: 0, animationDuration: 900,
      markLine: undefined }],
  };

  // Jam rawan: jam melingkar 24 jam (1 = rata-rata harian stasiun).
  const kel = Object.keys(diu.kelompok_pm25_rel);
  const hours = diu.jam.map((h) => String(h).padStart(2, "0"));
  const clock: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: any) => `${fmt(v, 2)}× rata-rata` },
    legend: { bottom: 0, textStyle: { fontSize: 11 }, itemWidth: 12 },
    polar: { radius: ["12%", "72%"], center: ["50%", "47%"] },
    angleAxis: { type: "category", data: [...hours, "24"], startAngle: 90, clockwise: true, boundaryGap: false,
      axisLabel: { fontSize: 10.5, color: C.inkSoft, interval: 2, formatter: (v: string) => (v === "24" ? "" : v) }, axisLine: { lineStyle: { color: "#d7e1e4" } }, splitLine: { show: true, lineStyle: { color: "#eef3f4" } } },
    radiusAxis: { min: pol === "pm25" ? 0.8 : 0.5, max: pol === "pm25" ? 1.4 : 2.4, axisLabel: { show: false }, splitLine: { lineStyle: { color: "#e3eaec" } }, axisLine: { show: false } },
    series: pol === "pm25"
      ? kel.map((k) => {
          const key = k === "Gambut" || k === "Roadside";
          return { name: k === "Roadside" ? "Tepi jalan" : k, type: "line" as const, coordinateSystem: "polar" as const, symbol: "none", smooth: true, data: [...diu.kelompok_pm25_rel[k], diu.kelompok_pm25_rel[k][0]], z: key ? 3 : 1,
            itemStyle: { color: k === "Gambut" ? C.gambut : k === "Roadside" ? C.focus : C.otherSoft }, lineStyle: { width: key ? 3 : 1.4 },
            areaStyle: key ? { opacity: 0.1 } : undefined, emphasis: { focus: "series" as const }, animationDuration: 1600 };
        })
      : [{ name: "O₃", type: "line", coordinateSystem: "polar", symbol: "none", smooth: true, data: [...diu.o3_rel, diu.o3_rel[0]], itemStyle: { color: C.focus }, lineStyle: { width: 3 }, areaStyle: { opacity: 0.12 } },
         { name: "NO₂", type: "line", coordinateSystem: "polar", symbol: "none", smooth: true, data: [...diu.no2_rel, diu.no2_rel[0]], itemStyle: { color: C.other }, lineStyle: { width: 2.5, type: "dashed" } }],
  };

  // Hari episode asap berat hanya di stasiun kawasan gambut (sama dengan laporan; Samarinda kawasan industri dipisah).
  const gambutHari = (y: number) => eps.episode.filter((e) => byCode[e.code]?.gambut && Number(e.mulai.slice(0, 4)) === y).reduce((a, e) => a + e.hari, 0);
  const peak = (y: string) => Math.max(...mon.bulan.map((b, k) => (b.startsWith(y) ? mon.gambut[k] ?? 0 : 0)));
  const longest = eps.episode.filter((e) => byCode[e.code]?.gambut).sort((a, b) => b.hari - a.hari)[0];
  const start = Math.min(...Object.values(cal.minggu_awal));
  const hd = [2024, 2025, 2026].map(gambutHari);
  const pk = ["2024", "2025", "2026"].map(peak);

  return (
    <Page path="/waktu"
      headline="Musim Asap Datang Tiap Akhir Juli, dan Tiap Tahun Makin Pekat"
      kpis={<>
        <Kpi k="Puncak Bulanan Kawasan Gambut" v={`${fmt(pk[0], 0)} → ${fmt(pk[2], 0)}`} unit={UG}
          viz={<BarsViz values={pk} labels={["2024", "2025", "2026"]} tone="gambut" />} note={`2025: ${fmt(pk[1], 0)}. Puncak 2026 = ${fmt(pk[2] / pk[0], 1)} kali puncak 2024.`} />
        <Kpi k="Hari Asap Berat di Kawasan Gambut" v={`${hd[0]} → ${hd[2]}`} unit="hari"
          viz={<BarsViz values={hd} labels={["2024", "2025", "2026*"]} tone="alert" />} note={`Episode = ≥3 hari berturut-turut di atas 150 ${UG}. *2026 baru sampai 14 Okt.`} />
        <Kpi k="Episode Terpanjang" v={`${longest.hari}`} unit="hari berturut-turut"
          viz={<WeeksViz from={weekOf(longest.mulai)} to={weekOf(longest.selesai)} label={byCode[longest.code].nama} />}
          note={`${byCode[longest.code].nama}, ${fmtDate(longest.mulai)} – ${fmtDate(longest.selesai)}.`} />
        <Kpi k="Musim Risiko Dimulai" v={`Minggu ke-${start}`}
          viz={<WeeksViz from={start} to={43} label="Akhir Juli – Oktober" />}
          note={Object.entries(cal.minggu_awal).map(([y, w]) => `${y}: minggu ${w}`).join(", ") + ". Hampir tidak bergeser."} />
      </>}
      main={
        <Card title="Rata-rata Bulanan Kawasan Gambut" sub="Tiga tahun ditumpuk. Pita oranye = Juli–Oktober. Angka di puncak = bulan terburuk tiap tahun.">
          <Chart option={seasonal} height={340} ariaLabel="Rata-rata bulanan PM2.5 kawasan gambut per tahun" />
        </Card>
      }
      method="Titik harian sah bila ≥18 jam valid; mingguan bila ≥4 hari valid; bulanan bila ≥15 hari valid. Episode asap berat = ≥3 hari berturut-turut PM2.5 harian > 150,4 µg/m³; angka di atas hanya stasiun kawasan gambut (Samarinda, kawasan industri, dihitung terpisah). Kalender risiko = % hari-stasiun gambut dengan PM2.5 > 55,4 µg/m³. Jam: rata-rata per jam dibagi rata-rata harian stasiun itu. Selisih hari kerja dan akhir pekan: median 0,03%."
      stories={<>
        <Story tone="gambut" title="Kalender Risiko: Kapan Harus Waspada"
          big={`Minggu ke-${start}`} bigNote="Awal musim risiko, sama di ketiga tahun"
          chart={<Chart option={calOpt} height={260} ariaLabel="Kalender risiko mingguan kawasan gambut" />}>
          <p>Setiap kotak satu minggu. Makin gelap, makin banyak hari tidak sehat. Pola akhir Juli sampai Oktober berulang <b>tiap tahun</b>, jadi siaga bisa dijadwalkan sebelum asap datang.</p>
        </Story>
        <Story flip tone="focus" title="Jam Rawan: Kota Berdetak, Asap Tidak"
          big={pol === "pm25" ? "07–09 & 17–19" : "Siang"} bigNote={pol === "pm25" ? "Jam puncak stasiun tepi jalan" : "O₃ memuncak saat matahari terik"}
          right={<Seg value={pol} onChange={setPol} options={[["pm25", "PM2.5"], ["gas", "O₃ & NO₂"]]} />}
          chart={<Chart option={clock} height={360} ariaLabel="Profil jam PM2.5 dalam bentuk jam melingkar" />}>
          <p>Baca seperti jam dinding: jam 00 di atas, berputar searah jarum jam. Garis yang menjauh dari tengah berarti di atas rata-rata hariannya. Garis <b>tepi jalan</b> menonjol di jam berangkat dan pulang kerja; garis <b>gambut</b> hampir bulat karena asap tidak mengenal jam.</p>
        </Story>
      </>}
      more={[<div key="ts" data-title="Deret Harian per Stasiun"><TimeSeries daily={daily} /></div>]}
    />
  );
}
