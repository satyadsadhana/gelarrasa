import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { EChartsOption } from "echarts";
import Chart from "../components/Chart";
import StationMap from "../components/StationMap";
import Stage3D from "../components/Stage3D";
import { useTour } from "../components/Tour";
import { useData } from "../lib/data";
import { fmt, fmtDate, UG } from "../lib/format";
import { dayMask, PERIODE, useApp, useStationFilter } from "../lib/state";
import { ISPU_COL, ISPU_LAB, ISPU_ON, ispuCat } from "../lib/theme";
import type { Daily, Weekly } from "../lib/types";

export default function Beranda() {
  const d = useData<[Weekly, Daily]>("weekly_station", "daily");
  const { periode, byCode, openProfil, pulau, kawasan } = useApp();
  const filt = useStationFilter();
  const tour = useTour();
  const weeks = d?.[0].minggu ?? [];
  const range = useMemo(() => {
    const p = PERIODE[periode];
    return weeks.map((w, i) => [w, i] as const)
      .filter(([w]) => w >= p.from && w <= p.to && (!("months" in p) || (p.months as readonly number[]).includes(Number(w.slice(5, 7)))))
      .map(([, i]) => i);
  }, [weeks, periode]);
  const [pos, setPos] = useState<number | null>(null);
  const [play, setPlay] = useState(false);
  useEffect(() => { setPos(null); setPlay(false); }, [periode]);
  useEffect(() => {
    if (!play) return;
    const t = setInterval(() => setPos((p) => {
      const n = (p ?? -1) + 1;
      if (n >= range.length) { setPlay(false); return range.length - 1; }
      return n;
    }), 140);
    return () => clearInterval(t);
  }, [play, range.length]);

  const values = useMemo(() => {
    if (!d) return {};
    const out: Record<string, number | null> = {};
    for (const [c, arr] of Object.entries(d[0].pm25)) {
      if (pos != null) out[c] = arr[range[pos]] ?? null;
      else {
        const v = range.map((i) => arr[i]).filter((x): x is number => x != null);
        out[c] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      }
    }
    return out;
  }, [d, pos, range]);

  /** Statistik ringkas dari data harian, mengikuti filter Periode, Wilayah, Kawasan. */
  const stats = useMemo(() => {
    if (!d) return null;
    const daily = d[1];
    const mask = dayMask(periode, daily.n, daily.mulai);
    let sum = 0, n = 0, over55 = 0, over150 = 0;
    const cat = [0, 0, 0, 0, 0];
    const per: { code: string; mean: number }[] = [];
    for (const [c, arr] of Object.entries(daily.pm25)) {
      if (byCode[c]?.dikecualikan || !filt(c)) continue;
      let s = 0, k = 0;
      arr.forEach((v, i) => {
        if (v == null || !mask[i]) return;
        s += v; k++; cat[ispuCat(v)]++;
        if (v > 55) over55++;
        if (v > 150.4) over150++;
      });
      sum += s; n += k;
      if (k >= 30) per.push({ code: c, mean: s / k });
    }
    per.sort((a, b) => b.mean - a.mean);
    return { mean: n ? sum / n : null, pct55: n ? (100 * over55) / n : null, over150, n, cat, top: per[0], low: per[per.length - 1], stations: per.length };
  }, [d, periode, filt, byCode]);

  if (!d || !stats) return <div className="loading">Memuat ringkasan dan peta stasiun…</div>;
  const label = pos == null ? `rata-rata ${PERIODE[periode].label}` : `minggu ${fmtDate(weeks[range[pos]])}`;
  const scope = [PERIODE[periode].label, pulau || "semua pulau", kawasan || "semua kawasan"].join(" · ");

  const catOpt: EChartsOption = {
    tooltip: { trigger: "item", formatter: (p: any) => `${p.seriesName}: <b>${fmt(p.value, 1)}%</b> hari-stasiun` },
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    xAxis: { type: "value", max: 100, show: false }, yAxis: { type: "category", data: [""], show: false },
    series: ISPU_LAB.map((l, i) => ({
      name: l, type: "bar", stack: "a", barWidth: 26, itemStyle: { color: ISPU_COL[i] },
      label: { show: (100 * stats.cat[i]) / stats.n > 7, formatter: (p: any) => `${fmt(p.value, 0)}%`, color: ISPU_ON[i], fontWeight: 700, fontSize: 12 },
      data: [stats.n ? (100 * stats.cat[i]) / stats.n : 0],
    })),
  };

  return (
    <main>
      <section className="hero3d" data-tour="map-card">
        <Stage3D values={values} visible={filt} height="100%" autoRotate
          fallback={<StationMap values={values} visible={filt} label={`PM2.5 ${label}`} height={520} />} />
        <div className="hero3d-text">
          <span className="kicker">27 stasiun · 27 rumah sakit · 2024–2026</span>
          <h1>Udara yang kita hirup</h1>
          <p>Tiap tiang adalah satu stasiun. Makin tinggi, makin pekat PM2.5 yang terhirup. Putar waktunya dan lihat asap datang dari Kalimantan dan Sumatra.</p>
          <button className="hero-tour" onClick={() => tour.start()}>▶ Mulai tur 3 menit</button>
        </div>
        <div className="player hero3d-player">
          <button onClick={() => { if (!play && (pos == null || pos >= range.length - 1)) setPos(0); setPlay(!play); }}>{play ? "❚❚ Jeda" : "▶ Putar waktu"}</button>
          <input type="range" min={0} max={Math.max(0, range.length - 1)} value={pos ?? 0} aria-label="Pilih minggu"
            onChange={(e) => { setPlay(false); setPos(Number(e.target.value)); }} />
          <span className="when">{pos == null ? `Rata-rata ${PERIODE[periode].label}` : `Minggu ${fmtDate(weeks[range[pos]])}`}</span>
          {pos != null && <button onClick={() => { setPlay(false); setPos(null); }}>Rata-rata</button>}
        </div>
      </section>
      <div className="kpis row">
        <div className="kpi"><span className="k">Rata-rata PM2.5</span><div className="v">{fmt(stats.mean)} <small>{UG}</small></div><p>baku mutu tahunan nasional 15 · WHO 5</p></div>
        <div className="kpi"><span className="k">Hari udara melewati baku mutu</span><div className="v">1 dari {fmt(100 / Math.max(stats.pct55 ?? 0, 0.1), 0)} <small>hari</small></div><p>{fmt(stats.pct55, 1)}% hari, PM2.5 &gt; 55 {UG}</p></div>
        <div className="kpi"><span className="k">Hari Sangat Tidak Sehat</span><div className="v">{fmt(stats.over150, 0)} <small>hari</small></div><p>dijumlah dari semua stasiun · PM2.5 &gt; 150 {UG}</p></div>
        <div className="kpi">
          <span className="k">Rata-rata tertinggi · terendah</span>
          <div className="v sm">
            {stats.top ? <button className="link-btn big" onClick={() => openProfil(stats.top.code)}>{byCode[stats.top.code].nama}</button> : "–"}
            <small> {fmt(stats.top?.mean)}</small>
          </div>
          <p>terendah: {stats.low ? <button className="link-btn" onClick={() => openProfil(stats.low.code)}>{byCode[stats.low.code].nama}</button> : "–"} ({fmt(stats.low?.mean)} {UG})</p>
        </div>
      </div>
      <section className="card ispu-strip">
        <div className="card-head"><div><h2>Berapa hari udaranya sehat?</h2><p className="sub">{scope} · {stats.stations} stasiun · persen hari menurut kategori ISPU</p></div></div>
        <Chart option={catOpt} height={34} />
        <div className="legend" style={{ marginTop: 8 }}>{ISPU_LAB.map((l, i) => <span key={l}><i style={{ background: ISPU_COL[i] }} />{l}</span>)}</div>
      </section>
      <nav className="pager">
        <span />
        <Link to="/kondisi">Mulai: <b>Seberapa kotor udaranya?</b> →</Link>
      </nav>
    </main>
  );
}
