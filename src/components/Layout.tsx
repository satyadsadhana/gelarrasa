import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { KAWASAN, PERIODE, PULAU, useApp, type FilterKey, type PeriodeKey } from "../lib/state";
import { useTour } from "./Tour";
import StationPicker from "./StationPicker";
import NavIcon from "./NavIcon";

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
    : <span className="brand-logo-slot" title="Letakkan file logo di web/public/logo-gelar-rasa.png">GELAR RASA</span>;
}

function Sidebar() {
  const tour = useTour();
  return (
    <aside className="side">
      <Link to="/" className="brand" aria-label="ASAP, ke Ringkasan">
        <Logo />
        <span><b>ASAP</b><small>Udara & kesehatan · 27 wilayah · 2024–2026</small></span>
      </Link>
      <nav className="side-nav" aria-label="Halaman">
        {PAGES.map((p) => (
          <NavLink key={p.path} to={p.path} end title={p.short}>
            <span className="q"><NavIcon path={p.path} /></span>
            <span className="t"><b>{p.short}</b><small>{p.label}</small></span>
            <span className="n" aria-hidden>{p.nav}</span>
          </NavLink>
        ))}
      </nav>
      <div className="side-foot">
        <NavLink to="/tentang" className="side-link">Tentang Data</NavLink>
        <button className="tour-btn" onClick={() => tour.start()}>▶ Mulai tur</button>
      </div>
    </aside>
  );
}

function FilterBar() {
  const { pathname } = useLocation();
  const app = useApp();
  const page = PAGES.find((p) => p.path === pathname);
  // Tentang Data tidak dipengaruhi filter apa pun, jadi semua filter disembunyikan di sana.
  const on = (k: FilterKey) => (pathname === "/tentang" ? false : !page || (page.filters as readonly string[]).includes(k));
  const off = "Filter ini tidak berlaku di halaman ini";
  const active: { k: string; label: string }[] = [];
  if (app.periode !== "semua" && on("periode")) active.push({ k: "periode", label: PERIODE[app.periode].label });
  if (app.pulau && on("pulau")) active.push({ k: "pulau", label: app.pulau });
  if (app.kawasan && on("kawasan")) active.push({ k: "kawasan", label: app.kawasan });

  return (
    <div className="filters">
      <div className="filters-row">
        <div className="fgroup">
        <label title={on("periode") ? "" : off}>Periode
          <select value={app.periode} disabled={!on("periode")} onChange={(e) => app.set("periode", e.target.value === "semua" ? null : e.target.value)}>
            {(Object.keys(PERIODE) as PeriodeKey[]).map((k) => <option key={k} value={k}>{PERIODE[k].label}</option>)}
          </select>
        </label>
        <label title={on("pulau") ? "" : off}>Wilayah
          <select value={app.pulau} disabled={!on("pulau")} onChange={(e) => app.set("pulau", e.target.value)}>
            <option value="">Semua pulau</option>
            {PULAU.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label title={on("kawasan") ? "" : off}>Kawasan
          <select value={app.kawasan} disabled={!on("kawasan")} onChange={(e) => app.set("kawasan", e.target.value)}>
            <option value="">Semua</option>
            {KAWASAN.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label title={on("acuan") ? "Acuan pembanding" : off} data-tour="acuan">Acuan
          <span className="seg" role="group">
            {(["nasional", "who"] as const).map((a) => (
              <button key={a} aria-pressed={app.acuan === a} disabled={!on("acuan")} onClick={() => app.set("acuan", a === "nasional" ? null : a)}>
                {a === "nasional" ? "Nasional" : "WHO"}
              </button>
            ))}
          </span>
        </label>
        </div>
        <div data-tour="picker"><StationPicker compact /></div>
        {active.length > 0 && (
          <div className="chips" aria-label="Filter aktif">
            {active.map((a) => (
              <span className="chip filter" key={a.k}>{a.label}<button aria-label={`Hapus filter ${a.label}`} onClick={() => app.set(a.k, null)}>×</button></span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <div className="content">
        <FilterBar />
        {children}
        <footer>
          Data: Dataset DA Gelar Rasa 2026 (sintetis) · Acuan: PP 22/2021, Permen LHK 14/2020 & 27/2021, WHO 2021 · <Link to="/tentang">Tentang Data →</Link>
        </footer>
      </div>
    </div>
  );
}

type PageProps = {
  path: string; main: ReactNode; method?: ReactNode; kpis?: ReactNode;
  supports?: ReactNode[]; extra?: ReactNode;
};
/** Kerangka halaman topik: judul + satu kalimat, (opsional) deret angka, grafik utama selebar halaman, grafik pendukung. */
export function Page({ path, main, method, kpis, supports, extra }: PageProps) {
  const i = PAGES.findIndex((p) => p.path === path);
  const p = PAGES[i], prev = PAGES[i - 1], next = PAGES[i + 1] ?? null;
  return (
    <main>
      <div className="q-head">
        <h1 className="page-title">{p.short}</h1>
        <p className="page-desc">{p.desc}{method && <MethodNote>{method}</MethodNote>}</p>
      </div>
      {kpis && <div data-tour="kpis" className="kpis row" style={{ marginTop: 0, marginBottom: "var(--gap)" }}>{kpis}</div>}
      <div data-tour="main">{main}</div>
      {supports && <div className={`grid-sup ${supports.length % 2 === 0 ? "two" : ""}`}>{supports}</div>}
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
