import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StationMap from "../components/StationMap";
import Stage3D from "../components/Stage3D";
import NavIcon from "../components/NavIcon";
import { Kpi, PAGES } from "../components/Layout";
import { BarsViz, Count, DotsViz, Flow, PillarsViz, Reveal, RulerViz, Waffle } from "../components/Viz";
import { useTour } from "../components/Tour";
import { useData } from "../lib/data";
import { fmt, fmtDate, fmtPct, UG } from "../lib/format";
import { dateAt, dayMask, PERIODE, useApp, useStationFilter } from "../lib/state";
import { ISPU_COL, ISPU_LAB, ispuCat } from "../lib/theme";
import type { AngkaKunci, Daily, Weekly } from "../lib/types";

export default function Beranda() {
  const d = useData<[Weekly, Daily, AngkaKunci]>("weekly_station", "daily", "angka_kunci");
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
    const yearOf = Array.from({ length: daily.n }, (_, i) => dateAt(i, daily.mulai).slice(0, 4));
    let sum = 0, n = 0, over55 = 0, over150 = 0;
    const cat = [0, 0, 0, 0, 0];
    const perYear: Record<string, number> = { "2024": 0, "2025": 0, "2026": 0 };
    const per: { code: string; mean: number }[] = [];
    for (const [c, arr] of Object.entries(daily.pm25)) {
      if (byCode[c]?.dikecualikan || !filt(c)) continue;
      let s = 0, k = 0;
      arr.forEach((v, i) => {
        if (v == null || !mask[i]) return;
        s += v; k++; cat[ispuCat(v)]++;
        if (v > 55) over55++;
        if (v > 150.4) { over150++; perYear[yearOf[i]]++; }
      });
      sum += s; n += k;
      if (k >= 30) per.push({ code: c, mean: s / k });
    }
    per.sort((a, b) => b.mean - a.mean);
    return { mean: n ? sum / n : null, pct55: n ? (100 * over55) / n : null, over150, perYear, n, cat, top: per[0], low: per[per.length - 1], stations: per.length };
  }, [d, periode, filt, byCode]);

  if (!d || !stats) return <div className="loading">Memuat ringkasan dan peta stasiun…</div>;
  const ak = d[2];
  const label = pos == null ? `rata-rata ${PERIODE[periode].label}` : `minggu ${fmtDate(weeks[range[pos]])}`;
  const scope = [PERIODE[periode].label, pulau || "semua pulau", kawasan || "semua kawasan"].join(", ");
  const oneIn = Math.max(1, Math.round(100 / Math.max(stats.pct55 ?? 0, 0.1)));
  const pct = stats.cat.map((c) => (stats.n ? (100 * c) / stats.n : 0));
  const sehat = pct[0];
  const ratio = stats.top && stats.low ? stats.top.mean / stats.low.mean : null;

  // jawaban singkat tiap pertanyaan, muncul saat kursor diarahkan ke halte
  const rr = ak.rr_per_lipat_dua["ISPA balita"].rr;
  const dek = (ak as unknown as { "dekomposisi_variasi_%": Record<string, number> })["dekomposisi_variasi_%"]["Musim/episode (stasiun-bulan)"];
  const ANS: Record<string, string> = {
    "/kondisi": `${ak.tahunan["2025"].lampaui_baku_mutu_15} dari ${ak.tahunan["2025"].stasiun_sah} stasiun melewati baku mutu tahunan 2025.`,
    "/waktu": "Musim asap datang tiap akhir Juli dan memuncak September–Oktober.",
    "/pemicu": `${fmt(dek, 0)}% naik-turun PM2.5 ditentukan musim, bukan cuaca harian.`,
    "/dampak": `ISPA balita naik ${fmtPct((rr - 1) * 100, 0, true)} tiap PM2.5 berlipat dua.`,
    "/jaringan": `${ak.jaringan.Andal} dari 27 stasiun andal; sisanya punya masalah data.`,
    "/aksi": `Batas harian 55 ${UG} di 2025: ${fmt(-ak.beban_2025_batas55["ISPA balita"].kasus, 0)} kasus ISPA balita lebih sedikit.`,
  };

  return (
    <main>
      <section className="hero3d" data-tour="map-card">
        <Stage3D values={values} visible={filt} height="100%" autoRotate
          fallback={<StationMap values={values} visible={filt} label={`PM2.5 ${label}`} height={520} />} />
        <div className="hero3d-text">
          <h1>Udara yang Kita Hirup</h1>
          <p>Setiap tiang adalah satu stasiun pemantau. Makin tinggi tiangnya, makin pekat PM2.5 di udara. Putar waktunya untuk melihat asap datang dari Kalimantan dan Sumatra.</p>
          <div className="hero-cta">
            <button className="hero-tour" onClick={() => tour.start()}>▶ Mulai Tur Cerita</button>
            <Link className="ghost" to="/kondisi">Langsung ke Pertanyaan Pertama</Link>
          </div>
        </div>
        <div className="player hero3d-player">
          <button onClick={() => { if (!play && (pos == null || pos >= range.length - 1)) setPos(0); setPlay(!play); }}>{play ? "❚❚ Jeda" : "▶ Putar Waktu"}</button>
          <input type="range" min={0} max={Math.max(0, range.length - 1)} value={pos ?? 0} aria-label="Pilih minggu"
            onChange={(e) => { setPlay(false); setPos(Number(e.target.value)); }} />
          <span className="when">{pos == null ? `Rata-rata ${PERIODE[periode].label}` : `Minggu ${fmtDate(weeks[range[pos]])}`}</span>
          {pos != null && <button onClick={() => { setPlay(false); setPos(null); }}>Rata-rata</button>}
        </div>
      </section>

      <section className="ledger">
        <p className="lede">
          Dashboard ini membaca <span className="n">27</span> stasiun pemantau udara dan <span className="n">27</span> rumah sakit pasangannya
          selama <span className="n">1.018</span> hari, dari 1 Januari 2024 sampai 14 Oktober 2026.
        </p>
        <aside>
          <span className="tag">Dataset sintetis dari panitia Gelar Rasa 2026</span>
          <span>Sebelum dihitung, data dibersihkan dulu: sensor beku, satuan keliru, dan stasiun rusak dipisahkan. <Link to="/tentang">Lihat prosesnya</Link></span>
        </aside>
      </section>

      <div className="sec-head">
        <h2>Empat Angka untuk Memulai</h2>
        <p>Mengikuti filter di kanan atas: {scope}.</p>
      </div>
      <Flow label="Empat angka utama">
        <Kpi k="Rata-rata PM2.5 Harian" v={<Count to={stats.mean} d={1} />} unit={UG}
          viz={<RulerViz value={stats.mean ?? 0} max={Math.max(60, (stats.mean ?? 0) * 1.25)} marks={[{ v: 5, l: "WHO 5" }, { v: 15, l: "Nasional 15" }]} />}
          note={`Garis = batas rata-rata tahunan. Angka ini ${fmt((stats.mean ?? 0) / 15, 1)} kali batas nasional.`} />
        <Kpi k="Hari Melewati Baku Mutu Harian" v={<>1 dari <Count to={oneIn} /></>} unit="hari"
          viz={<DotsViz n={1} total={oneIn} tone="alert" />}
          note={`${fmt(stats.pct55, 1)}% hari-stasiun punya PM2.5 di atas 55 ${UG}.`} />
        <Kpi k="Hari Sangat Tidak Sehat" v={<Count to={stats.over150} />} unit="hari"
          viz={<BarsViz values={["2024", "2025", "2026"].map((y) => stats.perYear[y])} labels={["2024", "2025", "2026*"]} tone="gambut" />}
          note={`Dijumlah dari semua stasiun, PM2.5 di atas 150 ${UG}. *2026 baru sampai 14 Oktober.`} />
        <Kpi k="Stasiun Terpekat dan Terbersih"
          v={stats.top ? <button className="link-btn big" onClick={() => openProfil(stats.top.code)}>{byCode[stats.top.code].nama}</button> : "–"}
          viz={stats.top && stats.low ? <PillarsViz items={[{ l: byCode[stats.top.code].nama, v: stats.top.mean }, { l: byCode[stats.low.code].nama, v: stats.low.mean }]} /> : null}
          note={<>{fmt(stats.top?.mean)} vs {fmt(stats.low?.mean)} {UG}: {ratio ? `${fmt(ratio, 1)} kali lipat` : ""}. Terbersih: {stats.low ? <button className="link-btn" onClick={() => openProfil(stats.low.code)}>{byCode[stats.low.code].nama}</button> : "–"}.</>} />
      </Flow>

      <div className="sec-head">
        <h2>Berapa Hari Udaranya Sehat?</h2>
        <p>Setiap kotak = 1 dari 100 hari-stasiun, diwarnai menurut kategori ISPU PM2.5.</p>
      </div>
      <Reveal as="section" className="healthy" data-tour="ispu">
        <Waffle parts={stats.cat} colors={ISPU_COL} labels={[...ISPU_LAB]} />
        <div>
          <div className="healthy-big"><Count to={Math.round(sehat)} /> <small>dari 100 hari</small></div>
          <h3>{sehat < 10 ? "Udara Berkategori Baik Hampir Tidak Pernah Terjadi" : "Udara Berkategori Baik Masih Jarang"}</h3>
          <p className="scope">{scope} · {stats.stations} stasiun · {fmt(stats.n, 0)} hari-stasiun</p>
          <ul className="cat-list">
            {ISPU_LAB.map((l, i) => (
              <li key={l}>
                <span className="sw"><i style={{ background: ISPU_COL[i] }} />{l}</span>
                <span className="bar"><i style={{ background: ISPU_COL[i], "--w": `${pct[i]}%`, "--k": i } as React.CSSProperties} /></span>
                <b>{fmt(pct[i], 0)}%</b>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <div className="sec-head">
        <h2>Enam Pertanyaan, Satu Jalur</h2>
        <p>Dari kondisi udara sampai langkah yang bisa diambil. Arahkan kursor ke halte untuk mengintip jawabannya.</p>
      </div>
      <Reveal as="section" className="route" data-tour="route">
        <ol>
          {PAGES.slice(1).map((p, k) => (
            <li className="stop" key={p.path} style={{ "--k": k } as React.CSSProperties}>
              <Link to={p.path}>
                <span className="dot"><NavIcon path={p.path} size={24} /></span>
                <small>Bagian {k + 2} · {p.short}</small>
                <b>{p.q}</b>
                <span className="ans">{ANS[p.path]}</span>
              </Link>
            </li>
          ))}
        </ol>
        <div className="route-foot">
          <p>Lebih suka diantar? Tur cerita merangkum keenam jawaban dalam delapan adegan.</p>
          <Link to="/kondisi">Mulai dari Pertanyaan Pertama</Link>
        </div>
      </Reveal>
    </main>
  );
}
