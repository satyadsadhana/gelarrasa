import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { MapViewState } from "@deck.gl/core";
import NavIcon from "./NavIcon";
import { BarsViz, Count, ParticleBox, Reveal } from "./Viz";
import { useData } from "../lib/data";
import { useApp } from "../lib/state";
import { fmt, fmtPct, UG } from "../lib/format";
import type { AngkaKunci, Summary } from "../lib/types";

// deck.gl dimuat hanya saat tur dibuka
const Stage3D = lazy(() => import("./Stage3D"));

/**
 * Tur cerita: delapan adegan layar penuh. Peta 3D di belakang terbang ke wilayah yang dibahas,
 * panel kanan memberi satu jawaban, satu insight tambahan yang tidak ada di halaman, dan satu
 * "kilas balik" yang mengingatkan grafik di halaman aslinya. Adegan terakhir merangkum semuanya.
 */
const KEY = "nn-tour-seen-v4";

type T = { start: () => void };
const Ctx = createContext<T>({ start: () => {} });
export const useTour = () => useContext(Ctx);

type Annual = { per_stasiun: { code: string; tahun: number; rata2: number; lengkap: boolean; lampaui_PP22: boolean }[] };
type View = "nasional" | "barat" | "kalimantan" | "jawa" | "rendah" | MapViewState;
type Scene = {
  path: string; chapter: string; head: string; body: ReactNode; extra?: ReactNode; recall?: ReactNode; viz?: ReactNode;
  view: View; values: Record<string, number | null>; labels?: string[]; cap?: number | null; visible?: (c: string) => boolean;
};

function Frozen() {
  return (
    <svg className="tv-frozen" viewBox="0 0 300 90" aria-hidden>
      <path className="live" pathLength={1} d="M0 52 C10 30 18 70 28 48 S44 22 54 50 S70 74 80 44 S96 30 104 56 L110 50" />
      <path className="flat" pathLength={1} d="M110 50 L230 50" />
      <path className="live2" pathLength={1} d="M230 50 C238 28 248 70 258 46 S276 30 286 56 S296 40 300 48" />
      <rect x="110" y="22" width="120" height="56" rx="8" className="band" />
      <text x="170" y="16" textAnchor="middle">7.329 jam angka sama persis</text>
      <text x="170" y="88" textAnchor="middle" className="ok">label QC: VALID</text>
    </svg>
  );
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<number | null>(null);
  const nav = useNavigate();
  const { byCode } = useApp();
  const d = useData<[Summary[], Annual, AngkaKunci]>("station_summary", "annual", "angka_kunci");
  const capture = typeof location !== "undefined" && new URLSearchParams(location.search).has("capture");

  useEffect(() => {
    if (capture || location.pathname !== "/") return;
    try { if (!localStorage.getItem(KEY)) { const t = setTimeout(() => setStep(0), 1400); return () => clearTimeout(t); } } catch { /* storage diblokir */ }
  }, [capture]);

  const end = useCallback((go?: string) => {
    setStep(null);
    try { localStorage.setItem(KEY, "1"); } catch { /* abaikan */ }
    if (go) nav(go);
  }, [nav]);

  const scenes = useMemo<Scene[]>(() => {
    if (!d) return [];
    const [summ, ann, ak] = d;
    const mean = Object.fromEntries(summ.map((s) => [s.code, s.rata2_pm25]));
    const p26 = Object.fromEntries(summ.map((s) => [s.code, s.periode_2026]));
    const v25 = Object.fromEntries(ann.per_stasiun.filter((r) => r.tahun === 2025 && r.lengkap).map((r) => [r.code, r.rata2]));
    const natMean = summ.reduce((a, s) => a + s.rata2_pm25, 0) / summ.length;
    const t25 = ak.tahunan["2025"];
    const pk = ak.puncak_bulanan_gambut;
    const ep = ak.episode_berat;
    const dek = (ak as unknown as { "dekomposisi_variasi_%": Record<string, number> })["dekomposisi_variasi_%"];
    const shap = (ak as unknown as { "shap_pemicu_%": Record<string, number> })["shap_pemicu_%"];
    const cuaca = (shap["Suhu"] ?? 0) + (shap["Kelembapan"] ?? 0) + (shap["Angin (kecepatan & arah)"] ?? 0);
    const rr = ak.rr_per_lipat_dua;
    const pct = (k: string) => fmtPct((rr[k].rr - 1) * 100, 0, true);
    const kritis = (ak as unknown as { "pencemar_kritis_%": Record<string, number> })["pencemar_kritis_%"]?.["PM2.5"];
    const minggu = (ak as unknown as { minggu_awal_risiko_gambut: Record<string, number> }).minggu_awal_risiko_gambut;
    const b55 = ak.beban_2025_batas55;
    const ktg = byCode["KTG-01"], bjb = byCode["BJB-01"];
    const fly = (s: { lon: number; lat: number } | undefined, zoom = 5.8, bearing = -20): View =>
      s ? { longitude: s.lon, latitude: s.lat - 1.1, zoom, pitch: 58, bearing } : "nasional";
    const dekM = dek["Musim/episode (stasiun-bulan)"], dekL = dek["Lokasi (antar stasiun)"], dekH = dek["Hari ke hari"];
    return [
      { path: "/", chapter: "Pembuka", view: "nasional", values: mean,
        head: "Tiga Menit, Enam Pertanyaan",
        body: <>Kita menyusuri <b>27 stasiun</b> pemantau udara dan <b>27 rumah sakit</b> pasangannya, dari Sumatra sampai Papua, selama 1.018 hari.</>,
        extra: <>Setiap tiang di belakang adalah satu stasiun. Tinggi = rata-rata PM2.5, warna = kategori ISPU. Tekan <kbd>→</kbd> untuk lanjut.</> },
      { path: "/kondisi", chapter: "Bagian 2 · Kualitas Udara", view: "nasional", values: v25,
        head: `${t25.lampaui_baku_mutu_15} dari ${t25.stasiun_sah} Stasiun di Atas Baku Mutu`,
        body: <>Rata-rata PM2.5 tahun 2025 di hampir semua stasiun melewati batas tahunan nasional 15 {UG}.</>,
        extra: kritis ? <>PM2.5 menjadi polutan penentu ISPU pada <b>{fmt(kritis, 1)}%</b> hari. Gas lain hampir tidak pernah jadi masalah utama.</> : undefined,
        recall: <>Di halamannya, titik oranye paling kanan pada grafik per pulau adalah stasiun gambut yang paling pekat.</>,
        viz: <div className="tv-pair"><ParticleBox value={15} title="Batas WHO" size={150} /><ParticleBox value={natMean} title="Rata-rata Stasiun" size={150} /></div> },
      { path: "/waktu", chapter: "Bagian 3 · Pola Waktu", view: "kalimantan", values: p26,
        head: "Asap Datang Tiap Akhir Juli",
        body: <>Musim risiko di kawasan gambut dimulai <b>minggu ke-{Math.min(...Object.values(minggu))}</b> dan memuncak September–Oktober, berulang tiga tahun.</>,
        extra: <>Jumlah hari asap berat di semua stasiun naik dari <b>{ep["2024"].total_hari}</b> (2024) ke <b>{ep["2026"].total_hari}</b> (2026), padahal data 2026 baru sampai 14 Oktober.</>,
        recall: <>Di halamannya, kotak gelap pada kalender risiko selalu mulai di minggu yang sama.</>,
        viz: <Reveal className="tv-bars"><span className="tv-cap">Puncak bulanan gambut ({UG})</span><BarsViz values={[pk["2024"], pk["2025"], pk["2026"]]} labels={[`2024 · ${fmt(pk["2024"], 0)}`, `2025 · ${fmt(pk["2025"], 0)}`, `2026 · ${fmt(pk["2026"], 0)}`]} tone="gambut" /></Reveal> },
      { path: "/pemicu", chapter: "Bagian 4 · Faktor Pemicu", view: "barat", values: p26,
        head: "Musim, Bukan Cuaca Harian",
        body: <><b>{fmt(dekM, 0)}%</b> naik-turun PM2.5 ditentukan musim dan episode asap. Lokasi menjelaskan {fmt(dekL, 0)}%, sisanya hari ke hari.</>,
        extra: <>Suhu, kelembapan, dan angin bersama-sama hanya menggeser <b>{fmt(cuaca, 0)}%</b>. Mengendalikan kebakaran lebih menentukan daripada menunggu cuaca.</>,
        recall: <>Di halamannya, batang tiga warna menunjukkan bagian musim paling lebar.</>,
        viz: <Reveal className="tv-stack" aria-hidden>
          <span style={{ "--w": `${dekM}%` } as React.CSSProperties} className="m"><b>Musim {fmt(dekM, 0)}%</b></span>
          <span style={{ "--w": `${dekL}%` } as React.CSSProperties} className="l"><b>Lokasi {fmt(dekL, 0)}%</b></span>
          <span style={{ "--w": `${Math.max(dekH, 2)}%` } as React.CSSProperties} className="h" />
        </Reveal> },
      { path: "/dampak", chapter: "Bagian 5 · Dampak Kesehatan", view: fly(ktg), values: mean, labels: ["KTG-01"],
        head: "Saat PM2.5 Berlipat Dua, Pasien Ikut Naik",
        body: <>Di rumah sakit pasangan, kasus ISPA balita naik <b>{pct("ISPA balita")}</b> setiap PM2.5 harian berlipat dua. Efeknya muncul di hari yang sama.</>,
        extra: <>Lansia hampir sama rentannya ({pct("ISPA lansia")}). Perlindungan tidak cukup hanya untuk anak.</>,
        recall: <>Di halamannya, batang dosis-respons makin tinggi setiap kategori ISPU memburuk.</>,
        viz: <Reveal className="tv-rr">
          {(["ISPA balita", "ISPA lansia", "Darurat asma", "Kematian"] as const).map((k, i) => (
            <span key={k} style={{ "--w": `${Math.min(100, (rr[k].rr - 1) * 150)}%`, "--k": i } as React.CSSProperties}><small>{k}</small><i /><b>{pct(k)}</b></span>
          ))}
        </Reveal> },
      { path: "/jaringan", chapter: "Bagian 6 · Jaringan Pemantauan", view: fly(bjb, 6.2), values: mean, labels: ["BJB-01", "SM2-01"],
        head: `${ak.jaringan.Andal} dari 27 Stasiun Andal`,
        body: <>Sensor Banjarbaru membeku sekitar sepuluh bulan, tetapi setiap jamnya tetap berlabel <b>VALID</b>.</>,
        extra: <>{ak.jaringan["TERSEMBUNYI (status Active)"]} stasiun bermasalah masih berstatus <b>Active</b> di metadata. Pemeriksaan yang hanya membaca label tidak akan menangkapnya.</>,
        recall: <>Di halamannya, tiang abu-abu pendek di peta adalah stasiun yang datanya tidak bisa dipercaya penuh.</>,
        viz: <Reveal className="tv-frozen-wrap"><Frozen /></Reveal> },
      { path: "/aksi", chapter: "Bagian 7 · Simulasi & Rekomendasi", view: "rendah", values: Object.fromEntries(summ.map((s) => [s.code, s.p95_pm25])), cap: 55,
        head: "Batas 55 Berarti Ribuan Kasus Lebih Sedikit",
        body: <>Bila PM2.5 harian 2025 tidak pernah melewati 55 {UG}, 25 rumah sakit mencatat lebih sedikit kasus:</>,
        extra: <>Pada skenario yang sama, kematian berkurang sekitar <b>{fmt(-b55["Kematian"].kasus, 0)}</b>. Bagian tiang yang transparan di peta adalah yang terpotong.</>,
        recall: <>Di halamannya, Anda bisa menggeser batas sendiri dan memilih satu rumah sakit.</>,
        viz: <Reveal className="tv-saved">
          <span><b><Count to={-b55["ISPA balita"].kasus} /></b><small>ISPA balita</small></span>
          <span><b><Count to={-b55["ISPA lansia"].kasus} /></b><small>ISPA lansia</small></span>
        </Reveal> },
      { path: "/", chapter: "Penutup", view: "nasional", values: mean,
        head: "Yang Sudah Kita Lihat", body: null },
    ];
  }, [d, byCode]);

  const total = scenes.length;
  const go = useCallback((n: number) => setStep((s) => (s == null ? s : Math.max(0, Math.min(total - 1, n)))), [total]);

  useEffect(() => {
    if (step == null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopImmediatePropagation(); end(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); e.stopImmediatePropagation(); go(step + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopImmediatePropagation(); go(step - 1); }
    };
    addEventListener("keydown", h, true);
    document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", h, true); document.body.style.overflow = ""; };
  }, [step, go, end]);

  const s = step != null ? scenes[step] : null;
  const recap = scenes.slice(1, -1);

  return (
    <Ctx.Provider value={{ start: () => setStep(0) }}>
      {children}
      {step != null && (
        <div className="tv" role="dialog" aria-modal="true" aria-label="Tur cerita">
          <div className="tv-stage">
            {s && <Suspense fallback={null}><Stage3D values={s.values} view={s.view} labels={s.labels ?? []} cap={s.cap ?? null} height="100%" autoRotate={step === 0 || step === total - 1} /></Suspense>}
          </div>
          <div className="tv-shade" aria-hidden />
          <header className="tv-top">
            <img src="/logo-gelar-rasa-terang.png" alt="Logo Gelar Rasa 2026" />
            <span>Tur Cerita</span>
            <button className="tv-x" onClick={() => end()} aria-label="Tutup tur">Tutup <kbd>Esc</kbd></button>
          </header>
          {!s ? <div className="tv-card"><p>Menyiapkan tur…</p></div> : (
            <article className="tv-card" key={step}>
              <span className="tv-chapter">{s.chapter}</span>
              <h2>{s.head}</h2>
              {step === total - 1 ? (
                <ol className="tv-recap">
                  {recap.map((r, k) => (
                    <li key={k} style={{ "--k": k } as React.CSSProperties}>
                      <button onClick={() => go(k + 1)}><NavIcon path={r.path} size={18} /><span><small>{r.chapter.replace(/^Bagian \d · /, "")}</small><b>{r.head}</b></span></button>
                    </li>
                  ))}
                </ol>
              ) : <>
                {s.body && <p className="tv-body">{s.body}</p>}
                {s.viz && <div className="tv-viz">{s.viz}</div>}
                {s.extra && <p className="tv-extra"><span>{step === 0 ? "Cara Membaca" : "Insight Tambahan"}</span>{s.extra}</p>}
                {s.recall && <p className="tv-recall"><span>Kilas Balik</span>{s.recall}</p>}
              </>}
              <div className="tv-actions">
                {step === total - 1
                  ? <><button className="tv-primary" onClick={() => end("/kondisi")}>Jelajahi Sendiri dari Bagian 2</button><button className="tv-ghost" onClick={() => go(0)}>Ulangi Tur</button></>
                  : <>{s.path !== "/" && <button className="tv-ghost" onClick={() => end(s.path)}>Buka Halaman Ini</button>}
                    <button className="tv-primary" onClick={() => go(step + 1)}>Lanjut</button></>}
              </div>
            </article>
          )}
          <nav className="tv-progress" aria-label="Adegan">
            <button className="tv-arrow" onClick={() => go(step - 1)} disabled={step === 0} aria-label="Adegan sebelumnya">‹</button>
            {scenes.map((sc, k) => (
              <button key={k} className={k === step ? "on" : k < step ? "done" : ""} onClick={() => go(k)} aria-label={`Adegan ${k + 1}: ${sc.head}`} aria-current={k === step ? "step" : undefined}>
                <i /><small>{sc.chapter.replace(/^Bagian \d · /, "")}</small>
              </button>
            ))}
            <button className="tv-arrow" onClick={() => go(step + 1)} disabled={step >= total - 1} aria-label="Adegan berikutnya">›</button>
          </nav>
        </div>
      )}
    </Ctx.Provider>
  );
}
