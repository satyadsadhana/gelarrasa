import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import Chart from "./Chart";
import StationPicker from "./StationPicker";
import { Seg } from "./Layout";
import { BULAN, fmt, fmtDate, UG } from "../lib/format";
import { dateAt, PERIODE, useApp, useStationFilter } from "../lib/state";
import { C, ISPU_COL, ISPU_LAB, ispuCat, PICK_COL } from "../lib/theme";
import type { Daily } from "../lib/types";

type Res = "hari" | "minggu" | "bulan";
const RES_LABEL: Record<Res, string> = { hari: "Harian", minggu: "Mingguan", bulan: "Bulanan" };
/** Minimal hari valid agar satu titik mingguan/bulanan dianggap sah. */
const MIN_DAYS: Record<Res, number> = { hari: 1, minggu: 4, bulan: 15 };
const BAND_ALPHA = ["1c", "16", "24", "16", "0c"];

/** Kelompokkan indeks hari ke titik waktu sesuai resolusi. */
function buckets(n: number, start: string, res: Res) {
  const keys: string[] = [];
  const idx: number[][] = [];
  const pos = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const d = dateAt(i, start);
    const k = res === "hari" ? d : res === "bulan" ? d.slice(0, 7) : dateAt(i - (i % 7), start); // 1 Jan 2024 = Senin
    if (!pos.has(k)) { pos.set(k, keys.length); keys.push(k); idx.push([]); }
    idx[pos.get(k)!].push(i);
  }
  return { keys, idx };
}
const mean = (arr: (number | null)[], ids: number[], min: number) => {
  let s = 0, k = 0;
  for (const i of ids) { const v = arr[i]; if (v != null) { s += v; k++; } }
  return k >= min ? s / k : null;
};

export default function TimeSeries({ daily }: { daily: Daily }) {
  const { pilihan, byCode, periode, openProfil } = useApp();
  const filt = useStationFilter();
  const [res, setRes] = useState<Res>("minggu");
  const [scale, setScale] = useState<"linear" | "log">("log");
  const [avg, setAvg] = useState(true);
  const [win, setWin] = useState<[number, number] | null>(null);
  useEffect(() => { setWin(null); }, [periode, res]);

  const { keys, idx } = useMemo(() => buckets(daily.n, daily.mulai, res), [daily, res]);

  /** Rata-rata semua stasiun (sesuai filter Wilayah & Kawasan) per hari. */
  const avgDaily = useMemo(() => {
    const codes = Object.keys(daily.pm25).filter((c) => !byCode[c]?.dikecualikan && !byCode[c]?.cakupan_rendah && filt(c));
    return Array.from({ length: daily.n }, (_, i) => {
      let s = 0, k = 0;
      for (const c of codes) { const v = daily.pm25[c][i]; if (v != null) { s += v; k++; } }
      return k ? s / k : null;
    });
  }, [daily, byCode, filt]);

  const option = useMemo<EChartsOption>(() => {
    const p = PERIODE[periode];
    const inPeriod = (k: string) => (res === "bulan" ? k >= p.from.slice(0, 7) && k <= p.to.slice(0, 7) : k >= p.from && k <= p.to);
    const i0 = Math.max(0, keys.findIndex(inPeriod));
    let i1 = keys.length - 1;
    for (let i = keys.length - 1; i >= 0; i--) if (inPeriod(keys[i])) { i1 = i; break; }
    const lbl = (k: string) => (res === "bulan" ? `${BULAN[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}` : res === "minggu" ? `minggu ${fmtDate(k)}` : fmtDate(k));
    const smooth = res === "hari" ? false : 0.35;
    const pickSeries = pilihan.map((c, i) => ({
      name: byCode[c].nama, type: "line" as const, smooth, showSymbol: false, symbolSize: 6, connectNulls: false,
      sampling: res === "hari" ? ("lttb" as const) : undefined,
      lineStyle: { width: res === "hari" ? 1.4 : 2.6, color: PICK_COL[i] }, itemStyle: { color: PICK_COL[i] },
      emphasis: { focus: "series" as const, lineStyle: { width: res === "hari" ? 2 : 3.4 } },
      endLabel: { show: true, formatter: "{a}", color: C.ink, fontWeight: 700, fontSize: 12, textBorderColor: "#fff", textBorderWidth: 3 },
      data: idx.map((ids) => mean(daily.pm25[c], ids, MIN_DAYS[res])),
      z: 5 - i,
    }));
    const bands = [[0, 15.5], [15.5, 55.4], [55.4, 150.4], [150.4, 250.4], [250.4, 2000]].map(([a, b], i) => [
      { yAxis: Math.max(a, scale === "log" ? 1 : 0), itemStyle: { color: ISPU_COL[i] + BAND_ALPHA[i] }, name: ISPU_LAB[i] }, { yAxis: b },
    ]);
    return {
      animationDuration: 400,
      tooltip: {
        trigger: "axis", axisPointer: { type: "line", lineStyle: { color: C.inkSoft, type: "dashed" } },
        formatter: (ps: any) => {
          const rows = (ps as any[]).filter((q) => q.value != null).map((q) => {
            const v = q.value as number;
            return `<div style="display:flex;gap:10px;justify-content:space-between"><span>${q.marker}${q.seriesName}</span><b>${fmt(v)} ${UG}</b><span style="color:${C.inkSoft}">${ISPU_LAB[ispuCat(v)]}</span></div>`;
          });
          return `<b>${lbl(keys[ps[0].dataIndex])}</b>${rows.join("") || "<div>data tidak valid</div>"}`;
        },
      },
      legend: { show: false },
      labelLayout: { moveOverlap: "shiftY" },
      grid: { left: 8, right: 110, top: 16, bottom: 62 },
      xAxis: {
        type: "category", data: keys, boundaryGap: false,
        axisLabel: { formatter: (k: string) => (res === "bulan" ? `${BULAN[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}` : `${BULAN[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`), hideOverlap: true },
        axisTick: { show: false },
      },
      yAxis: { type: scale === "log" ? "log" : "value", name: `PM2.5 (${UG})${scale === "log" ? " · skala log" : ""}`, min: scale === "log" ? 5 : 0, max: (v: any) => v.max * (scale === "log" ? 1.6 : 1.08), splitLine: { show: false }, axisLabel: { showMaxLabel: false } },
      dataZoom: [
        { type: "slider", bottom: 10, height: 24, startValue: win?.[0] ?? i0, endValue: win?.[1] ?? i1, labelFormatter: (v: number) => lbl(keys[v] ?? ""), brushSelect: false },
        { type: "inside", zoomOnMouseWheel: "ctrl", moveOnMouseWheel: false, moveOnMouseMove: true },
      ],
      series: [
        {
          name: "Rata-rata semua stasiun", type: "line", smooth, showSymbol: false, silent: false,
          lineStyle: { width: 1.6, type: "dashed", color: C.other }, itemStyle: { color: C.other },
          data: avg ? idx.map((ids) => mean(avgDaily, ids, MIN_DAYS[res])) : [],
          endLabel: { show: avg, formatter: "Rata-rata", color: C.inkSoft, fontSize: 11 },
          markArea: { silent: true, label: { show: true, position: "insideLeft", color: C.inkSoft, fontSize: 10.5, opacity: 0.9 }, data: bands as any },
          markLine: { silent: true, symbol: "none", lineStyle: { color: C.inkSoft, type: "dotted" }, label: { formatter: "baku mutu harian 55", position: "insideStartTop", fontSize: 10.5 }, data: [{ yAxis: 55 }] },
          z: 1,
        },
        ...pickSeries,
      ],
    };
  }, [daily, keys, idx, res, scale, avg, avgDaily, pilihan, byCode, periode, win]);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>PM2.5 dari Waktu ke Waktu</h2>
          <p className="sub">Bandingkan hingga 3 stasiun. Pita latar = kategori ISPU. Skala log membuat stasiun bersih dan stasiun berasap sama-sama terbaca. Geser slider di bawah untuk memilih rentang waktu.</p>
        </div>
      </div>
      <div className="ts-ctrl">
        <StationPicker label="" compact />
        <div className="ts-opts">
          <Seg value={res} onChange={setRes} options={(Object.keys(RES_LABEL) as Res[]).map((r) => [r, RES_LABEL[r]])} />
          <Seg value={scale} onChange={setScale} options={[["log", "Skala log"], ["linear", "Skala linear"]]} />
          <label className="check"><input type="checkbox" checked={avg} onChange={(e) => setAvg(e.target.checked)} /> Rata-rata semua stasiun</label>
        </div>
      </div>
      {pilihan.length === 0 && <p className="note">Pilih minimal satu stasiun untuk menampilkan garis.</p>}
      <Chart option={option} height={400} ariaLabel="Grafik garis PM2.5 stasiun pilihan"
        onZoom={setWin} onClick={(q: any) => { const c = pilihan.find((x) => byCode[x].nama === q.seriesName); if (c) openProfil(c); }} />
    </section>
  );
}
