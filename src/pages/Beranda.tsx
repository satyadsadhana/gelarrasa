import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { EChartsOption } from "echarts";
import Chart from "../components/Chart";
import StationMap from "../components/StationMap";
import { PAGES } from "../components/Layout";
import { useTour } from "../components/Tour";
import { useData } from "../lib/data";
import { fmt, fmtDate, UG } from "../lib/format";
import { dayMask, PERIODE, useApp, useStationFilter } from "../lib/state";
import { ISPU_COL, ISPU_LAB, ISPU_ON, ispuCat } from "../lib/theme";
import type { Daily, Weekly } from "../lib/types";

const COVER = [
  ["27", "stasiun pemantau (AQMS)"], ["21", "provinsi di 5 pulau"], ["27", "rumah sakit pasangan"],
  ["1.018", "hari, 1 Jan 2024 – 14 Okt 2026"], ["6", "polutan + 4 variabel cuaca"], ["7", "jenis kasus kesehatan harian"],
];

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

  if (!d || !stats) return <div className="loading">Memuat…</div>;
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
      <section className="hero">
        <h1>Kualitas Udara & Kesehatan di 27 Wilayah Indonesia</h1>
        <p>Data pemantauan udara per jam dan kasus rumah sakit harian, 1 Januari 2024 – 14 Oktober 2026. Pilih periode, pulau, atau kawasan di bar atas; semua angka di halaman ini ikut berubah.</p>
      </section>
      <div className="kpis row">
        <div className="kpi"><span className="k">Rata-rata PM2.5</span><div className="v">{fmt(stats.mean)} <small>{UG}</small></div><p>baku mutu tahunan nasional 15 · WHO 5</p></div>
        <div className="kpi"><span className="k">Hari melampaui baku mutu harian</span><div className="v">{fmt(stats.pct55, 1)}<small>%</small></div><p>dari {fmt(stats.n, 0)} hari-stasiun (PM2.5 &gt; 55 {UG})</p></div>
        <div className="kpi"><span className="k">Hari Sangat Tidak Sehat atau lebih</span><div className="v">{fmt(stats.over150, 0)} <small>hari-stasiun</small></div><p>PM2.5 harian &gt; 150 {UG}</p></div>
        <div className="kpi">
          <span className="k">Rata-rata tertinggi · terendah</span>
          <div className="v sm">
            {stats.top ? <button className="link-btn big" onClick={() => openProfil(stats.top.code)}>{byCode[stats.top.code].nama}</button> : "–"}
            <small> {fmt(stats.top?.mean)}</small>
          </div>
          <p>terendah: {stats.low ? <button className="link-btn" onClick={() => openProfil(stats.low.code)}>{byCode[stats.low.code].nama}</button> : "–"} ({fmt(stats.low?.mean)} {UG})</p>
        </div>
      </div>
      <div className="home">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Peta stasiun · PM2.5 {label}</h2>
              <p className="sub">Ukuran & warna titik = PM2.5 (kategori ISPU). Tekan ▶ untuk memutar per minggu. Klik titik untuk profil stasiun.</p>
            </div>
          </div>
          <StationMap values={values} visible={filt} label={`PM2.5 ${label}`} height={420} />
          <div className="player">
            <button onClick={() => { if (!play && (pos == null || pos >= range.length - 1)) setPos(0); setPlay(!play); }}>{play ? "❚❚ Jeda" : "▶ Putar"}</button>
            <input type="range" min={0} max={Math.max(0, range.length - 1)} value={pos ?? 0} aria-label="Pilih minggu"
              onChange={(e) => { setPlay(false); setPos(Number(e.target.value)); }} />
            <span style={{ minWidth: 140 }}>{pos == null ? "Rata-rata periode" : fmtDate(weeks[range[pos]])}</span>
            {pos != null && <button onClick={() => { setPlay(false); setPos(null); }}>Rata-rata</button>}
          </div>
        </section>
        <aside className="kpis">
          <section className="card">
            <h2>Sebaran kategori ISPU harian</h2>
            <p className="sub">{scope} · {stats.stations} stasiun</p>
            <div style={{ marginTop: 10 }}><Chart option={catOpt} height={30} /></div>
            <div className="legend" style={{ marginTop: 8 }}>{ISPU_LAB.map((l, i) => <span key={l}><i style={{ background: ISPU_COL[i] }} />{l}</span>)}</div>
          </section>
          <section className="card">
            <h2>Cakupan data</h2>
            <dl className="cover">{COVER.map(([v, l]) => <div key={l}><dt>{v}</dt><dd>{l}</dd></div>)}</dl>
            <div className="cta" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => tour.start()}>▶ Tur 3 menit</button>
              <Link to="/tentang" className="btn ghost">Tentang data</Link>
            </div>
          </section>
        </aside>
      </div>
      <h2 className="section-title">Jelajahi</h2>
      <div className="findings">
        {PAGES.slice(1).map((p) => (
          <Link key={p.path} to={p.path} className="finding"><span className="tag">{p.icon} {p.short}</span><p>{p.desc}</p></Link>
        ))}
      </div>
    </main>
  );
}
