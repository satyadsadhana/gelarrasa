import { useState } from "react";
import type { EChartsOption } from "echarts";
import Chart from "../components/Chart";
import { Card, Page, Seg } from "../components/Layout";
import { useData } from "../lib/data";
import { fmt, UG } from "../lib/format";
import { useApp, usePick, useStationFilter } from "../lib/state";
import { C, kawasanCol, MUTED } from "../lib/theme";

type Dec = { skala: Record<string, Record<string, number>>; "jam_dalam_hari_%": number };
type Shap = { "kontribusi_%": Record<string, number>; r2_uji_2026: number; r2_latih: number; korelasi_cuaca_per_jam_median: Record<string, number> };
type Traffic = { rho_pm25: number; rho_lalu_lintas_jarak: number; data: { code: string; pm25: number; traffic_intensity_per_h: number; distance_to_road_m: number; kelompok: string }[] };
type Rose = { sektor: string[]; "rentang_pm25_%": Record<string, number>; data: Record<string, { sektor: string; pm25_rel: number; so2_rel: number; "jam_%": number }[]> };

const DEC_COL = [C.focus, C.gambut, C.otherSoft];
const LAWAM: Record<string, string> = {
  "Musim (bulan & hari-dalam-tahun)": "Musim (bulan dalam setahun)", "Kelompok kawasan × musim": "Jenis kawasan × musim",
  "Angin (kecepatan & arah)": "Angin", Kelembapan: "Kelembapan", Suhu: "Suhu", "Hari dalam seminggu": "Hari kerja / akhir pekan",
};

export default function Q3Pemicu() {
  const d = useData<[Dec, Shap, Traffic, Rose]>("decomposition", "shap", "traffic", "rose");
  const { byCode, openProfil } = useApp();
  const pick = usePick();
  const filt = useStationFilter();
  const [skala, setSkala] = useState<"Skala asli (µg/m³)" | "Skala log">("Skala asli (µg/m³)");
  const [rs, setRs] = useState("JKT-02");
  if (!d) return <div className="loading">Memuat data faktor pemicu…</div>;
  const [dec, shap, tr, rose] = d;
  const comps = Object.keys(dec.skala[skala]);

  const decOpt: EChartsOption = {
    tooltip: { trigger: "item", formatter: (p: any) => `${p.seriesName}: <b>${fmt(p.value, 1)}%</b>` },
    legend: { bottom: 0 }, grid: { left: 8, right: 10, top: 10, bottom: 40 },
    xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" } }, yAxis: { type: "category", data: ["Variasi PM2.5 harian"], show: false },
    series: comps.map((c, i) => ({
      name: c, type: "bar", stack: "a", barWidth: 56, itemStyle: { color: DEC_COL[i] },
      label: { show: dec.skala[skala][c] > 4, formatter: (p: any) => `${fmt(p.value, 0)}%`, color: i === 2 ? C.ink : "#fff", fontSize: 18, fontWeight: 700 },
      data: [dec.skala[skala][c]],
    })),
  };

  const sh = Object.entries(shap["kontribusi_%"]).sort((a, b) => a[1] - b[1]);
  const shapOpt: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: any) => `${fmt(v, 1)}%` },
    grid: { left: 8, right: 40, top: 6, bottom: 10 },
    xAxis: { type: "value", show: false }, yAxis: { type: "category", data: sh.map(([k]) => LAWAM[k] ?? k), axisLabel: { fontSize: 11 } },
    series: [{ type: "bar", data: sh.map(([k, v]) => ({ value: v, itemStyle: { color: k.startsWith("Musim") ? C.gambut : k.startsWith("Kelompok") ? C.gambutSoft : C.otherSoft } })),
      label: { show: true, position: "right", formatter: (p: any) => `${fmt(p.value, 1)}%`, fontSize: 11 } }],
  };

  const trOpt: EChartsOption = {
    tooltip: { formatter: (p: any) => `<b>${byCode[p.data.code].nama}</b> · ${p.data.kel}<br/>${fmt(p.value[0], 0)} kendaraan/jam · ${fmt(p.data.jarak, 0)} m dari jalan<br/>PM2.5 Jan–Jun: <b>${fmt(p.value[1])}</b> ${UG}` },
    grid: { left: 8, right: 14, top: 14, bottom: 30 },
    xAxis: { type: "value", name: "kendaraan/jam", nameLocation: "middle", nameGap: 24 }, yAxis: { type: "value", name: `PM2.5 Jan–Jun (${UG})` },
    series: [{ type: "scatter", data: tr.data.map((r) => ({
      value: [r.traffic_intensity_per_h, r.pm25], code: r.code, kel: r.kelompok, jarak: r.distance_to_road_m,
      symbolSize: Math.min(34, 8 + 900 / Math.max(r.distance_to_road_m, 20)),
      itemStyle: { color: filt(r.code) ? kawasanCol(r.kelompok) : MUTED, opacity: 0.85, borderColor: pick(r.code) ?? "#fff", borderWidth: pick(r.code) ? 3 : 1 },
    })) }],
  };

  const rd = rose.data[rs];
  const roseOpt: EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (v: any) => `${fmt(v, 2)}×` },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    polar: { radius: "68%", center: ["50%", "46%"] },
    angleAxis: { type: "category", data: rose.sektor, startAngle: 90 + 22.5, clockwise: true },
    radiusAxis: { min: 0, max: 1.3, axisLabel: { fontSize: 9 } },
    series: [
      { name: "PM2.5 relatif", type: "bar", coordinateSystem: "polar", data: rd.map((r) => (r["jam_%"] >= 2 ? r.pm25_rel : null)), itemStyle: { color: C.focus, opacity: 0.85 } },
      { name: "SO₂ relatif", type: "line", coordinateSystem: "polar", data: rd.map((r) => (r["jam_%"] >= 2 ? r.so2_rel : null)), itemStyle: { color: C.other }, lineStyle: { type: "dashed" }, symbolSize: 4 },
    ],
  };


  return (
    <Page path="/pemicu"
      headline="Musim menentukan, lalu lintas menambah di kota"
      main={
        <Card title="Sumber variasi PM2.5 harian"
          sub="Dari mana naik-turun PM2.5 berasal"
          right={<Seg value={skala} onChange={setSkala} options={[["Skala asli (µg/m³)", "Skala asli"], ["Skala log", "Skala log"]]} />}
>
          <Chart option={decOpt} height={170} />
        </Card>
      }
      method={`Dekomposisi varians bertingkat: stasiun → bulan → hari. Kontribusi faktor dari LightGBM + SHAP pada simpangan log PM2.5 dari rata-rata stasiunnya sendiri; dilatih 2024–2025, diuji 2026 (R² ${fmt(shap.r2_uji_2026, 2)}). Lalu lintas dan jarak ke jalan saling terkait (ρ = ${fmt(tr.rho_lalu_lintas_jarak, 2)}), jadi dibaca sebagai satu faktor paparan jalan raya. Korelasi cuaca per jam: median |ρ| ≤ 0,12.`}
      supports={[
        <Card key="a" title="Faktor di dalam satu stasiun" sub="% kontribusi (SHAP)">
          <Chart option={shapOpt} height={250} />
        </Card>,
        <Card key="b" title="Makin ramai jalan, makin kotor" sub="Jan–Jun · satu titik = satu stasiun · besar = dekat jalan">
          <Chart option={trOpt} height={250} onClick={(p: any) => p.data?.code && openProfil(p.data.code)} />
        </Card>,
      ]}
      more={[
        <Card key="c" title="Arah angin dan PM2.5" sub={`${byCode[rs].nama} · selisih antar arah ${fmt(rose["rentang_pm25_%"][rs], 1)}%`}
          right={<div className="tabs">{Object.keys(rose.data).map((c) => <button key={c} aria-pressed={rs === c} onClick={() => setRs(c)}>{byCode[c].nama}</button>)}</div>}>
          <Chart option={roseOpt} height={250} />
        </Card>,
      ]}
    />
  );
}
