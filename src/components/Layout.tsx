import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { KAWASAN, PERIODE, PULAU, useApp, type FilterKey, type PeriodeKey } from "../lib/state";
import { useTour } from "./Tour";
import StationPicker from "./StationPicker";
import { PICK_COL, PICK_GLYPH } from "../lib/theme";
import NavIcon from "./NavIcon";
import { Flow, InfoTip, Reveal } from "./Viz";

// deck.gl dimuat terpisah supaya halaman pertama tetap ringan
const PageStage = lazy(() => import("./PageStage"));


export const PAGES = [
  { path: "/", short: "Ringkasan", nav: "Ringkasan", q: "Gambaran Umum 27 Stasiun dan 27 Rumah Sakit", label: "Gambaran umum data", desc: "Gambaran umum 27 stasiun pemantau dan 27 rumah sakit, 1 Jan 2024 – 14 Okt 2026.", filters: ["periode", "pulau", "kawasan"] },
  { path: "/kondisi", short: "Kualitas Udara", nav: "Udara", q: "Seberapa Kotor Udara Kita?", label: "Baku mutu, ISPU, IKU & tren", desc: "Rata-rata dan lonjakan PM2.5 tiap stasiun dibandingkan baku mutu nasional, target WHO, dan IKU, beserta trennya.", filters: ["pulau", "kawasan", "acuan"] },
  { path: "/waktu", short: "Pola Waktu", nav: "Waktu", q: "Kapan Udara Paling Berbahaya?", label: "Harian, musiman, episode", desc: "Pergerakan PM2.5 dari hari ke hari, pola musiman, awal musim risiko, dan pola jam.", filters: ["periode", "pulau", "kawasan"] },
  { path: "/pemicu", short: "Faktor Pemicu", nav: "Pemicu", q: "Apa yang Membuat Udara Kotor?", label: "Musim, lalu lintas, cuaca", desc: "Sumber variasi PM2.5: lokasi, musim, lalu lintas, cuaca, dan arah angin.", filters: ["pulau", "kawasan"] },
  { path: "/dampak", short: "Dampak Kesehatan", nav: "Dampak", q: "Apa Dampaknya bagi Kesehatan?", label: "PM2.5 & kasus rumah sakit", desc: "Hubungan PM2.5 harian dengan kasus ISPA, asma, PPOK, kardiovaskular, dan kematian di 25 rumah sakit.", filters: [] },
  { path: "/jaringan", short: "Jaringan Pemantauan", nav: "Jaringan", q: "Bisakah Datanya Dipercaya?", label: "Kualitas data stasiun", desc: "Keandalan data tiap stasiun, penempatan stasiun, dan prioritas perbaikan.", filters: ["pulau", "kawasan"] },
  { path: "/aksi", short: "Simulasi & Rekomendasi", nav: "Simulasi", q: "Apa yang Bisa Dilakukan?", label: "Skenario kebijakan", desc: "Simulasi jumlah kasus bila PM2.5 dibatasi atau dikurangi, dan rekomendasi tindakan.", filters: [] },
] as const;

/** Rel navigasi kiri: logo Gelar Rasa di puncak, ikon + label tiap halaman, lalu Tentang Data dan Tur. */
function Rail() {
  const tour = useTour();
  return (
    <aside className="rail" aria-label="Navigasi utama">
      <Link to="/" className="rail-logo" aria-label="Kembali ke Ringkasan">
        <img src="/logo-gelar-rasa.png" alt="Logo Gelar Rasa 2026" />
      </Link>
      <nav className="rail-nav" aria-label="Halaman">
        {PAGES.map((p, i) => (
          <NavLink key={p.path} to={p.path} end className="rail-item">
            <NavIcon path={p.path} size={21} />
            <span>{p.nav}</span>
            <em className="rail-tip" role="tooltip"><small>Bagian {i + 1}</small><b>{p.short}</b>{p.q}</em>
          </NavLink>
        ))}
      </nav>
      <div className="rail-foot">
        <NavLink to="/tentang" className="rail-item">
          <NavIcon path="/tentang" size={20} /><span>Data</span>
          <em className="rail-tip" role="tooltip"><b>Tentang Data</b>Pembersihan, metode, dan keterbatasan</em>
        </NavLink>
        <button className="rail-item rail-tour" onClick={() => tour.start()}>
          <NavIcon path="tur" size={21} /><span>Tur</span>
          <em className="rail-tip" role="tooltip"><b>Tur Cerita</b>Delapan adegan, kurang dari 3 menit</em>
        </button>
      </div>
    </aside>
  );
}

/** Stasiun pilihan + filter, disembunyikan di balik satu tombol. */
function Settings() {
  const { pathname } = useLocation();
  const app = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  if (pathname === "/tentang") return null;
  const page = PAGES.find((p) => p.path === pathname);
  const on = (k: FilterKey) => !page || (page.filters as readonly string[]).includes(k);
  const active: { k: string; label: string }[] = [];
  if (app.periode !== "semua" && on("periode")) active.push({ k: "periode", label: PERIODE[app.periode].label });
  if (app.pulau && on("pulau")) active.push({ k: "pulau", label: app.pulau });
  if (app.kawasan && on("kawasan")) active.push({ k: "kawasan", label: app.kawasan });
  if (app.acuan === "who" && on("acuan")) active.push({ k: "acuan", label: "Acuan WHO" });

  return (
    <div className="settings" ref={ref} data-tour="acuan">
      <button className="settings-btn" data-tour="picker" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="pick-dots" aria-hidden>{app.pilihan.map((c, i) => <b key={c} style={{ color: PICK_COL[i] }}>{PICK_GLYPH[i]}</b>)}</span>
        <span className="names">{app.pilihan.map((c) => app.byCode[c]?.nama).join(", ") || "Pilih stasiun"}</span>
        {active.length > 0 && <span className="badge">{active.length} filter</span>}
        <span className="caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="settings-pop" role="dialog" aria-label="Stasiun pilihan dan filter">
          <StationPicker />
          <div className="fgroup">
            {on("periode") && <label>Periode
              <select value={app.periode} onChange={(e) => app.set("periode", e.target.value === "semua" ? null : e.target.value)}>
                {(Object.keys(PERIODE) as PeriodeKey[]).map((k) => <option key={k} value={k}>{PERIODE[k].label}</option>)}
              </select>
            </label>}
            {on("pulau") && <label>Wilayah
              <select value={app.pulau} onChange={(e) => app.set("pulau", e.target.value)}>
                <option value="">Semua pulau</option>
                {PULAU.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>}
            {on("kawasan") && <label>Kawasan
              <select value={app.kawasan} onChange={(e) => app.set("kawasan", e.target.value)}>
                <option value="">Semua</option>
                {KAWASAN.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>}
            {on("acuan") && <label>Acuan
              <span className="seg" role="group">
                {(["nasional", "who"] as const).map((a) => (
                  <button key={a} aria-pressed={app.acuan === a} onClick={() => app.set("acuan", a === "nasional" ? null : a)}>
                    {a === "nasional" ? "Nasional" : "WHO"}
                  </button>
                ))}
              </span>
            </label>}
          </div>
          {active.length > 0 && (
            <div className="chips" aria-label="Filter aktif">
              {active.map((a) => (
                <span className="chip filter" key={a.k}>{a.label}<button aria-label={`Hapus filter ${a.label}`} onClick={() => app.set(a.k, null)}>×</button></span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Panah kiri/kanan berpindah halaman (kecuali saat memakai kontrol atau grafik). */
function useArrowNav() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    const order = [...PAGES.map((p) => p.path), "/tentang"];
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.altKey || e.ctrlKey || e.metaKey || t.closest("input, select, textarea, [role=slider], canvas")) return;
      const i = order.indexOf(pathname);
      if (e.key === "ArrowRight" && i >= 0 && i < order.length - 1) nav(order[i + 1]);
      if (e.key === "ArrowLeft" && i > 0) nav(order[i - 1]);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [pathname, nav]);
}

export default function Layout({ children }: { children: ReactNode }) {
  useArrowNav();
  return (
    <div className="shell">
      <Rail />
      <header className="topbar">
        <Link to="/" className="topbar-logo" aria-label="Kembali ke Ringkasan"><img src="/logo-gelar-rasa.png" alt="Logo Gelar Rasa 2026" /></Link>
        <Settings />
      </header>
      <div className="content">{children}</div>
    </div>
  );
}

type PageProps = {
  path: string; main: ReactNode; method?: ReactNode; kpis?: ReactNode;
  supports?: ReactNode[]; extra?: ReactNode;
  /** Jawaban (kalimat temuan) yang tampil sebagai judul besar di bawah pertanyaan halaman. */
  headline?: ReactNode;
  /** Baris cerita selebar halaman (teks + grafik, bergantian kiri-kanan). */
  stories?: ReactNode;
  /** Grafik detail untuk analis, ditaruh di panel "Telusuri Lebih Dalam" bertab. */
  more?: ReactNode[];
  /** Batas skenario untuk panggung 3D (halaman Simulasi). */
  stageCap?: number | null;
  /** Sembunyikan panggung 3D bawaan. */
  noStage?: boolean;
  /** Bagian tambahan tepat di bawah panggung 3D. */
  afterStage?: ReactNode;
};
/** Kerangka halaman topik: pertanyaan → jawaban → panggung 3D → jalur temuan → grafik utama → cerita → telusuri. */
export function Page({ path, main, method, kpis, supports, extra, stageCap, headline, more, stories, noStage, afterStage }: PageProps) {
  const i = PAGES.findIndex((p) => p.path === path);
  const p = PAGES[i];
  return (
    <main className="topic">
      <header className="q-head">
        <div className="q-meta">
          <span className="q-icon"><NavIcon path={path} size={18} /></span>
          <span className="q-name">{p.short}</span>
          <span className="q-prog" aria-label={`Bagian ${i + 1} dari ${PAGES.length}`}>
            {PAGES.map((_, k) => <i key={k} className={k < i ? "done" : k === i ? "on" : ""} />)}
          </span>
        </div>
        <p className="page-q">{p.q}</p>
        <h1 className="page-title">{headline ?? p.short}{method && <InfoTip>{method}</InfoTip>}</h1>
      </header>
      {!noStage && <Suspense fallback={<div className="stage3d" style={{ height: 440 }} />}><PageStage path={path} cap={stageCap} /></Suspense>}
      {afterStage}
      {kpis && <Flow label="Jalur temuan">{kpis}</Flow>}
      <div data-tour="main" className="main-slot">{main}</div>
      {stories && <div className="stories">{stories}</div>}
      {supports && <div className={`grid-sup ${supports.length % 2 === 0 ? "two" : ""}`}>{supports}</div>}
      {more && more.length > 0 && <MorePanel items={more} />}
      {extra}
      <Pager i={i} />
    </main>
  );
}

/** Panel analis: satu grafik tampil per tab, di dalam wadah padat (tidak menembus latar). */
function MorePanel({ items }: { items: ReactNode[] }) {
  const [open, setOpen] = useState(false);
  const [k, setK] = useState(0);
  const title = (n: ReactNode, idx: number) => {
    const pr = (n as { props?: { title?: ReactNode; "data-title"?: string } })?.props;
    const t = pr?.["data-title"] ?? pr?.title;
    return typeof t === "string" ? t : `Grafik ${idx + 1}`;
  };
  return (
    <section className={`more-panel${open ? " open" : ""}`}>
      <button className="more-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="more-ico" aria-hidden>{open ? "−" : "+"}</span>
        <span><b>Telusuri Lebih Dalam</b><small>{items.length} grafik tambahan untuk pembaca yang ingin detail</small></span>
      </button>
      {open && (
        <div className="more-body">
          {items.length > 1 && (
            <div className="more-tabs" role="tablist">
              {items.map((it, idx) => (
                <button key={idx} role="tab" aria-selected={k === idx} onClick={() => setK(idx)}>{title(it, idx)}</button>
              ))}
            </div>
          )}
          <div className="more-slot" key={k}>{items[Math.min(k, items.length - 1)]}</div>
        </div>
      )}
    </section>
  );
}

/** Ke bab berikutnya: pertanyaan halaman selanjutnya ditulis besar. */
function Pager({ i }: { i: number }) {
  const prev = PAGES[i - 1], next = PAGES[i + 1];
  return (
    <nav className="pager" aria-label="Pindah bagian">
      {prev ? <Link className="pg prev" to={prev.path}><small>Sebelumnya</small><b>{prev.short}</b></Link> : <span />}
      {next
        ? <Link className="pg next" to={next.path}><small>Lanjut ke Bagian {i + 2}: {next.short}</small><b>{next.q}</b><NavIcon path={next.path} size={26} /></Link>
        : <Link className="pg next" to="/tentang"><small>Penutup</small><b>Bagaimana Data Ini Dibersihkan?</b><NavIcon path="/tentang" size={26} /></Link>}
    </nav>
  );
}

/** Catatan cara hitung: ikon ⓘ kecil (dipertahankan untuk kompatibilitas). */
export function MethodNote({ children }: { children: ReactNode }) {
  return <InfoTip>{children}</InfoTip>;
}

/** Satu titik di jalur temuan: label, angka, visual mini, dan satu baris konteks. */
export function Kpi({ k, v, unit, note, viz }: { k: ReactNode; v: ReactNode; unit?: ReactNode; note?: ReactNode; viz?: ReactNode }) {
  return (
    <div className="fact" role="listitem">
      <span className="fact-node" aria-hidden />
      <span className="k">{k}</span>
      <div className="v">{v}{unit && <small> {unit}</small>}</div>
      {viz && <div className="fact-viz">{viz}</div>}
      {note && <p>{note}</p>}
    </div>
  );
}

/** Baris cerita: kolom teks (judul, angka besar, penjelasan) + grafik; `flip` menukar sisi. */
export function Story({ title, big, bigNote, children, chart, right, flip, tone = "focus" }: { title: ReactNode; big?: ReactNode; bigNote?: ReactNode; children?: ReactNode; chart: ReactNode; right?: ReactNode; flip?: boolean; tone?: "focus" | "gambut" | "alert" }) {
  return (
    <Reveal as="section" className={`story-row${flip ? " flip" : ""} t-${tone}`}>
      <div className="story-text">
        <h2>{title}</h2>
        {big && <div className="story-big">{big}</div>}
        {bigNote && <p className="story-bignote">{bigNote}</p>}
        {children && <div className="story-body">{children}</div>}
        {right && <div className="story-ctrl">{right}</div>}
      </div>
      <div className="story-chart">{chart}</div>
    </Reveal>
  );
}

export function Card({ title, sub, children, right, note }: { title: ReactNode; sub?: ReactNode; children: ReactNode; right?: ReactNode; note?: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <div><h2>{title}</h2>{sub && <p className="sub">{sub}</p>}</div>
        {right}
      </div>
      {children}
      {note && <p className="note">{note}</p>}
    </section>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <span className="seg" role="group">
      {options.map(([v, l]) => <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
    </span>
  );
}
