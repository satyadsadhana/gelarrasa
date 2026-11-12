import { useEffect, useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useNavigate } from "react-router-dom";
import Chart from "./Chart";
import { useData } from "../lib/data";
import { fmt, fmtDate, fmtPct, UG } from "../lib/format";
import { dateAt, useApp } from "../lib/state";
import { C, GRADE_STYLE, ISPU_COL, ispuCat, kawasanCol, PICK_COL, PICK_GLYPH } from "../lib/theme";
import type { Daily, HospitalDaily, Summary } from "../lib/types";

type Diurnal = { stasiun_pm25: Record<string, number[]>; khas_rel: number[] };
type RR = { per_rs: { hospital_id: string; outcome: string; rr_shrunk: number }[] };

export default function Profil() {
  const { profil, openProfil, byCode, pilihan, togglePilihan } = useApp();
  const nav = useNavigate();
  const d = useData<[Daily, Summary[], Diurnal, RR]>("daily", "station_summary", "diurnal", "rr");
  const h = useData<[HospitalDaily]>(...(profil ? ["hospital_daily"] : []));
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && openProfil(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [openProfil]);

  const s = profil ? byCode[profil] : null;
  const ts = useMemo<EChartsOption | null>(() => {
    if (!d || !s) return null;
    const arr = d[0].pm25[s.code] ?? [];
    const dates = arr.map((_, i) => dateAt(i));
    const gaps: [string, string][] = [];
    let st: number | null = null;
    arr.forEach((v, i) => { if (v == null && st == null) st = i; if ((v != null || i === arr.length - 1) && st != null) { gaps.push([dates[st], dates[v == null ? i : i - 1]]); st = null; } });
    return {
      tooltip: { trigger: "axis", valueFormatter: (v: any) => (v == null ? "tidak valid" : `${fmt(v)} ${UG}`) },
      grid: { left: 8, right: 10, top: 14, bottom: 26 },
      xAxis: { type: "category", data: dates, axisLabel: { formatter: (v: string) => (v.endsWith("-01-01") || v.endsWith("-07-01") ? fmtDate(v).slice(-8) : ""), interval: 0, hideOverlap: true } },
      yAxis: { type: "value", name: UG },
      visualMap: { show: false, dimension: 1, pieces: [{ lte: 15.5, color: ISPU_COL[0] }, { gt: 15.5, lte: 55.4, color: ISPU_COL[1] }, { gt: 55.4, lte: 150.4, color: "#d4a900" }, { gt: 150.4, lte: 250.4, color: ISPU_COL[3] }, { gt: 250.4, color: ISPU_COL[4] }] },
      series: [{ type: "line", data: arr, symbol: "none", lineStyle: { width: 1.2 }, connectNulls: false,
        markArea: { silent: true, itemStyle: { color: "rgba(120,120,120,0.16)" }, data: gaps.filter(([a, b]) => a !== b).map(([a, b]) => [{ xAxis: a }, { xAxis: b }]) as any },
        markLine: { silent: true, symbol: "none", lineStyle: { type: "dashed", color: "#555" }, label: { formatter: "55 baku mutu harian", fontSize: 10, position: "insideEndTop" }, data: [{ yAxis: 55 }] } }],
    };
  }, [d, s]);

  if (!s) return null;
  const sum = d?.[1].find((x) => x.code === s.code);
  const diu = d?.[2].stasiun_pm25[s.code];
  const khas = d?.[2].khas_rel;
  const diuMean = diu ? diu.reduce((a, b) => a + b, 0) / diu.length : 1;
  const rsR = d?.[3].per_rs.filter((r) => r.hospital_id === s.hospital_id) ?? [];
  const hd = h?.[0];
  const hr = hd?.rs[s.hospital_id];
  const idx = pilihan.indexOf(s.code);

  let rsOpt: EChartsOption | null = null;
  if (hr && hd) {
    const wk: { d: string; pm: number | null; y: number }[] = [];
    for (let i = 0; i < hd.n; i += 7) {
      const pm = hr.pm25.slice(i, i + 7).filter((v): v is number => v != null);
      const y = hr.resp.slice(i, i + 7).filter((v): v is number => v != null);
      wk.push({ d: dateAt(i), pm: pm.length ? pm.reduce((a, b) => a + b, 0) / pm.length : null, y: y.length ? y.reduce((a, b) => a + b, 0) / y.length : 0 });
    }
    rsOpt = {
      tooltip: { trigger: "axis" }, legend: { bottom: 0 }, grid: { left: 8, right: 8, top: 18, bottom: 34 },
      xAxis: { type: "category", data: wk.map((w) => fmtDate(w.d)), axisLabel: { fontSize: 10 } },
      yAxis: [{ type: "value", name: UG }, { type: "value", name: "kasus/hari", splitLine: { show: false } }],
      series: [
        { name: "PM2.5 (rata-rata mingguan)", type: "line", symbol: "none", data: wk.map((w) => w.pm), itemStyle: { color: C.other }, areaStyle: { opacity: 0.18 } },
        { name: "Rawat napas umum", type: "line", yAxisIndex: 1, symbol: "none", data: wk.map((w) => w.y), itemStyle: { color: C.focus } },
      ],
    };
  }

  return (
    <>
      <div className="scrim" onClick={() => openProfil(null)} />
      <aside className="drawer" data-tour="drawer" role="dialog" aria-label={`Profil stasiun ${s.nama}`}>
        <button className="drawer-close" onClick={() => openProfil(null)} aria-label="Tutup">×</button>
        <div className="q-kicker">{s.code} · {s.pulau}</div>
        <h2 style={{ fontSize: 24, marginTop: 4 }}>{s.nama}</h2>
        <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>{s.kecamatan}, {s.kota}, {s.provinsi}</p>
        <div className="chips" style={{ marginTop: 10 }}>
          <span className="pill" style={{ background: kawasanCol(s.kelompok), color: s.gambut ? "#fff" : "#18211c" }}>{s.kelompok}</span>
          {s.tipe && <span className="pill" style={{ background: "#eee" }}>{s.tipe}</span>}
          <span className="pill" style={{ background: "#eee" }}>Metadata: {s.status_metadata}</span>
          <span className="pill" style={{ background: GRADE_STYLE[s.grade].bg, color: GRADE_STYLE[s.grade].fg }}>Grade data {s.grade}</span>
        </div>
        {s.masalah !== "—" && <p className="disclaimer" style={{ marginTop: 10 }}>Masalah data: {s.masalah}{s.dikecualikan ? " · dikeluarkan dari analisis polutan" : ""}</p>}
        <div className="stats">
          <div className="stat"><b>{fmt(sum?.rata2_pm25)}</b><span>Rata-rata PM2.5 ({UG})</span></div>
          <div className="stat"><b>{fmt(sum?.pct_hari_gt55, 0)}%</b><span>hari &gt; 55 (baku mutu harian)</span></div>
          <div className="stat"><b>{sum?.hari_gt150 ?? "–"}</b><span>hari &gt; 150 (asap berat)</span></div>
          <div className="stat"><b>{s.excl_tren ? "–" : fmtPct(sum?.["ubah_%"], 0, true)}</b><span>tren 2024→2026 (1 Jan–14 Okt)</span></div>
          <div className="stat"><b>{fmt(sum?.iku_2025, 1)}</b><span>IKU 2025</span></div>
        </div>
        <div className="chips" style={{ marginBottom: 14 }}>
          <button className="btn ghost" style={{ padding: "8px 12px", fontSize: 13 }} onClick={() => togglePilihan(s.code)}>
            {idx >= 0 ? <><b style={{ color: PICK_COL[idx] }}>{PICK_GLYPH[idx]}</b> Hapus dari Stasiun Pilihan</> : "+ Tambahkan ke Stasiun Pilihan"}
          </button>
          {s.simulasi && <button className="btn primary" style={{ padding: "8px 12px", fontSize: 13 }} onClick={() => { if (idx < 0) togglePilihan(s.code); openProfil(null); nav("/aksi" + location.search); }}>Buka di simulator →</button>}
        </div>
        <section className="card"><h3>PM2.5 harian 2024–2026</h3><p className="sub">Area abu-abu = data tidak valid / beku dibuang.</p>{ts && <Chart option={ts} height={220} />}</section>
        {diu && khas && (
          <section className="card" style={{ marginTop: 12 }}><h3>Pola jam (waktu lokal)</h3>
            <Chart height={190} option={{
              tooltip: { trigger: "axis", valueFormatter: (v: any) => `${fmt(v, 2)}×` }, legend: { bottom: 0 }, grid: { left: 8, right: 8, top: 14, bottom: 32 },
              xAxis: { type: "category", data: diu.map((_, i) => String(i).padStart(2, "0")) }, yAxis: { type: "value", name: "× rata-rata", min: (v: any) => Math.floor(v.min * 10) / 10 },
              series: [{ name: s.nama, type: "line", symbol: "none", smooth: true, data: diu.map((v) => v / diuMean), lineStyle: { width: 2.5 }, itemStyle: { color: C.focus } },
                { name: "Profil khas stasiun lain", type: "line", symbol: "none", smooth: true, data: khas, lineStyle: { type: "dashed" }, itemStyle: { color: C.other } }],
            }} />
          </section>
        )}
        <section className="card" style={{ marginTop: 12 }}>
          <h3>RS pasangan: {s.rs_nama}</h3>
          <p className="sub">{s.rs_kelas} · {fmt(s.rs_tt, 0)} tempat tidur{rsR.length ? ` · Kenaikan ISPA balita per lipat dua di RS ini: ${fmtPct(((rsR.find((r) => r.outcome === "ISPA balita")?.rr_shrunk ?? 1) - 1) * 100, 0, true)}` : " · tidak masuk model (tanpa pasangan PM2.5 yang layak)"}</p>
          {rsOpt ? <Chart option={rsOpt} height={220} /> : <p className="note">Memuat data RS…</p>}
        </section>
        <p className="note">Warna ISPU terakhir: {sum ? ["Baik", "Sedang", "Tidak Sehat", "Sangat Tidak Sehat", "Berbahaya"][ispuCat(sum.rata2_pm25)] : "–"} (dari rata-rata).</p>
      </aside>
    </>
  );
}
