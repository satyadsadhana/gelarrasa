import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { KAWASAN, PERIODE, PULAU, useApp, type FilterKey, type PeriodeKey } from "../lib/state";
import { useTour } from "./Tour";
import StationPicker from "./StationPicker";
import { PICK_COL, PICK_GLYPH } from "../lib/theme";

// deck.gl dimuat terpisah supaya halaman pertama tetap ringan
const PageStage = lazy(() => import("./PageStage"));

export const PAGES = [
  { path: "/", short: "Ringkasan", nav: "Ringkasan", label: "Gambaran umum data", desc: "Gambaran umum 27 stasiun pemantau dan 27 rumah sakit, 1 Jan 2024 – 14 Okt 2026.", filters: ["periode", "pulau", "kawasan"] },
  { path: "/kondisi", short: "Kualitas Udara", nav: "Udara", label: "Baku mutu, ISPU, IKU & tren", desc: "Rata-rata dan lonjakan PM2.5 tiap stasiun dibandingkan baku mutu nasional, target WHO, dan IKU, beserta trennya.", filters: ["pulau", "kawasan", "acuan"] },
  { path: "/waktu", short: "Pola Waktu", nav: "Waktu", label: "Harian, musiman, episode", desc: "Pergerakan PM2.5 dari hari ke hari, pola musiman, awal musim risiko, dan pola jam.", filters: ["periode", "pulau", "kawasan"] },
  { path: "/pemicu", short: "Faktor Pemicu", nav: "Pemicu", label: "Musim, lalu lintas, cuaca", desc: "Sumber variasi PM2.5: lokasi, musim, lalu lintas, cuaca, dan arah angin.", filters: ["pulau", "kawasan"] },
  { path: "/dampak", short: "Dampak Kesehatan", nav: "Dampak", label: "PM2.5 & kasus rumah sakit", desc: "Hubungan PM2.5 harian dengan kasus ISPA, asma, PPOK, kardiovaskular, dan kematian di 25 rumah sakit.", filters: [] },
  { path: "/jaringan", short: "Jaringan Pemantauan", nav: "Jaringan", label: "Kualitas data stasiun", desc: "Keandalan data tiap stasiun, penempatan stasiun, dan prioritas perbaikan.", filters: ["pulau", "kawasan"] },
  { path: "/aksi", short: "Simulasi & Rekomendasi", nav: "Simulasi", label: "Skenario kebijakan", desc: "Simulasi jumlah kasus bila PM2.5 dibatasi atau dikurangi, dan rekomendasi tindakan.", filters: [] },
] as const;

function Logo() {
  const [ok, setOk] = useState(true);
  return ok
    ? <img src="/logo-gelar-rasa.png" alt="Logo Gelar Rasa 2026" onError={() => setOk(false)} />
    : <span className="brand-logo-slot" title="Letakkan file logo di public/logo-gelar-rasa.png">GELAR RASA</span>;
}

const num = (i: number) => String(i + 1).padStart(2, "0");

/** Menu: tertutup default. Hover tombol = titik navigasi; klik = panel meluncur dari kiri. */
function Menu() {
  const tour = useTour();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  return (
    <>
      <div className={`menu-wrap${open ? " hide" : ""}`}>
        <button className="menu-btn" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <span /><span /><span />
        </button>
        <nav className="dots" aria-label="Lompat ke halaman">
          {PAGES.map((p, i) => (
            <NavLink key={p.path} to={p.path} end aria-label={p.short}><i /><em>{num(i)} {p.nav}</em></NavLink>
          ))}
        </nav>
      </div>
      <div className={`scrim${open ? " on" : ""}`} onClick={() => setOpen(false)} aria-hidden />
      <aside className={`drawer-nav${open ? " on" : ""}`} aria-hidden={!open}>
        <button className="drawer-x" aria-label="Tutup menu" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>×</button>
        <nav aria-label="Halaman">
          {PAGES.map((p, i) => (
            <NavLink key={p.path} to={p.path} end tabIndex={open ? 0 : -1} style={{ "--d": open ? `${80 + i * 35}ms` : "0ms" } as React.CSSProperties}>
              <small>{num(i)}</small><b>{p.short}</b>
            </NavLink>
          ))}
        </nav>
        <div className="drawer-foot" style={{ "--d": open ? "340ms" : "0ms" } as React.CSSProperties}>
          <NavLink to="/tentang" tabIndex={open ? 0 : -1}>Tentang Data</NavLink>
          <button tabIndex={open ? 0 : -1} onClick={() => { setOpen(false); tour.start(); }}>Mulai tur</button>
          <span className="drawer-logo"><Logo /></span>
        </div>
      </aside>
    </>
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
      <Menu />
      <header className="topbar"><Settings /></header>
      <div className="content">{children}</div>
    </div>
  );
}

type PageProps = {
  path: string; main: ReactNode; method?: ReactNode; kpis?: ReactNode;
  supports?: ReactNode[]; extra?: ReactNode;
  /** Judul temuan (kalimat), menggantikan nama halaman sebagai judul besar. */
  headline?: ReactNode;
  /** Grafik detail untuk analis, dilipat di "Telusuri lebih dalam". */
  more?: ReactNode[];
  /** Batas skenario untuk panggung 3D (halaman Simulasi). */
  stageCap?: number | null;
};
/** Kerangka halaman topik: judul + satu kalimat, (opsional) deret angka, grafik utama selebar halaman, grafik pendukung. */
export function Page({ path, main, method, kpis, supports, extra, stageCap, headline, more }: PageProps) {
  const i = PAGES.findIndex((p) => p.path === path);
  const p = PAGES[i], prev = PAGES[i - 1], next = PAGES[i + 1] ?? null;
  return (
    <main>
      <div className="q-head">
        <span className="page-kicker">{String(i + 1).padStart(2, "0")} · {p.short}</span>
        <h1 className="page-title">{headline ?? p.short}</h1>
        {method && <div className="page-desc"><MethodNote>{method}</MethodNote></div>}
      </div>
      <Suspense fallback={<div className="stage3d" style={{ height: 380 }} />}><PageStage path={path} cap={stageCap} /></Suspense>
      {kpis && <div data-tour="kpis" className="kpis row" style={{ marginTop: 0, marginBottom: "var(--gap)" }}>{kpis}</div>}
      <div data-tour="main">{main}</div>
      {supports && <div className={`grid-sup ${supports.length % 2 === 0 ? "two" : ""}`}>{supports}</div>}
      {more && more.length > 0 && (
        <details className="more telusuri">
          <summary>Telusuri lebih dalam <small>{more.length} grafik untuk analis</small></summary>
          <div className="grid-sup two">{more}</div>
        </details>
      )}
      {extra}
      <nav className="pager">
        {prev ? <Link to={prev.path}>← <b>{prev.short}</b></Link> : <span />}
        {next ? <Link to={next.path}><b>{next.short}</b> →</Link> : <Link to="/tentang"><b>Tentang Data</b> →</Link>}
      </nav>
    </main>
  );
}

/** Catatan cara hitung: tersembunyi di balik tombol kecil supaya halaman tidak penuh teks. */
export function MethodNote({ children }: { children: ReactNode }) {
  return (
    <details className="method-note">
      <summary>Cara hitung</summary>
      <div>{children}</div>
    </details>
  );
}

/** Kartu angka kecil: label, nilai, dan satu baris konteks. */
export function Kpi({ k, v, unit, note }: { k: ReactNode; v: ReactNode; unit?: ReactNode; note?: ReactNode }) {
  return (
    <div className="kpi"><span className="k">{k}</span><div className="v">{v}{unit && <small> {unit}</small>}</div>{note && <p>{note}</p>}</div>
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
