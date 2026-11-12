import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../lib/state";

/**
 * Tur cerita: tiap langkah MENGGERAKKAN dashboard (pindah halaman, ganti acuan, buka profil),
 * lalu menampilkan satu insight (judul) dan satu cara pakai (baris "Coba").
 * Sorotan bisa membuka beberapa area sekaligus: grafik yang dibahas DAN kontrol yang disuruh diklik.
 * `targets` = nilai atribut data-tour; yang pertama dipakai untuk menggulir halaman.
 */
type Step = { path: string; targets: string[]; head: string; try: string; params?: Record<string, string | null>; profil?: string };
const STEPS: Step[] = [
  { path: "/", targets: ["map-card"], params: { acuan: null }, head: "27 stasiun, 1 Jan 2024 – 14 Okt 2026",
    try: "Tekan ▶ Putar di bawah peta untuk memutar minggu demi minggu; klik titik untuk profil stasiun." },
  { path: "/kondisi", targets: ["main", "acuan"], params: { acuan: "who" }, head: "Dengan target WHO paling longgar (35 µg/m³), 16 dari 24 stasiun masih gagal",
    try: "Tombol Nasional / WHO di bar atas mengganti garis acuan di semua grafik." },
  { path: "/waktu", targets: ["main", "picker"], params: { acuan: null }, head: "Palangka Raya meledak tiap Agustus; Marunda tinggi sepanjang tahun",
    try: "Ganti atau tambah Stasiun Pilihan di bar atas; warnanya sama di setiap halaman." },
  { path: "/dampak", targets: ["main"], head: "Saat PM2.5 Palangka Raya melonjak, kasus ISPA balita ikut naik di minggu yang sama",
    try: "Pilih jenis kasus lain di kanan atas grafik, misalnya Kematian." },
  { path: "/jaringan", targets: ["drawer"], profil: "BJB-01", head: "Sensor Banjarbaru beku 7.329 jam, tetapi tetap berlabel VALID",
    try: "Klik batang stasiun mana pun di grafik untuk membuka profil seperti ini." },
  { path: "/aksi", targets: ["kpis", "main"], head: "Untuk 25 RS, batas harian 55 µg/m³ berarti ±6.000 kasus ISPA balita lebih sedikit di 2025",
    try: "Pilih \"Semua 25 RS\" atau satu rumah sakit, lalu geser batasnya; angka di atas ikut berubah." },
];
const KEY = "nn-tour-seen";
const PAD = 6;

type T = { start: () => void };
const Ctx = createContext<T>({ start: () => {} });
export const useTour = () => useContext(Ctx);

type Box = { x: number; y: number; w: number; h: number };

/** Lapisan redup selayar penuh dengan "lubang" di setiap area yang disorot. Tidak menghalangi klik. */
function Spotlight({ boxes }: { boxes: Box[] }) {
  if (!boxes.length) return null;
  return (
    <svg className="tour-spot" width="100%" height="100%" aria-hidden>
      <defs>
        <mask id="tour-holes">
          <rect width="100%" height="100%" fill="white" />
          {boxes.map((b, k) => <rect key={k} x={b.x} y={b.y} width={b.w} height={b.h} rx={10} fill="black" />)}
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(12, 20, 28, 0.42)" mask="url(#tour-holes)" />
      {boxes.map((b, k) => <rect key={k} x={b.x} y={b.y} width={b.w} height={b.h} rx={10} fill="none" stroke="#ffffff" strokeWidth={3} />)}
    </svg>
  );
}

/**
 * Letakkan kotak tur di ruang kosong supaya tidak menutupi area yang disorot:
 * di bawah area bila muat, di kanan bila ada kolom kosong, di atas bila muat; selain itu tetap di bawah.
 */
function placeCard(boxes: Box[]): React.CSSProperties | undefined {
  if (!boxes.length || typeof window === "undefined") return undefined;
  const top = Math.min(...boxes.map((b) => b.y)), bottom = Math.max(...boxes.map((b) => b.y + b.h));
  const right = Math.max(...boxes.map((b) => b.x + b.w)), left = Math.min(...boxes.map((b) => b.x));
  const H = 210, W = innerWidth;
  if (innerHeight - bottom >= H + 16) return undefined; // bawah tengah (bawaan CSS)
  if (left >= 400) return { left: 16, right: "auto", transform: "none", width: Math.min(460, left - 32), bottom: 22 };
  if (W - right >= 340) return { left: right + 12, right: "auto", transform: "none", width: Math.min(460, W - right - 28), bottom: "auto", top: Math.max(96, Math.min(top, innerHeight - H - 24)) };
  if (top - 80 >= H + 16) return { top: 84, bottom: "auto" };
  return undefined;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<number | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const nav = useNavigate();
  const app = useApp();
  const capture = new URLSearchParams(location.search).has("capture");

  useEffect(() => {
    if (capture) return;
    // Tur otomatis hanya bila pengunjung masuk lewat Ringkasan; tautan langsung ke halaman lain tidak dibelokkan.
    if (location.pathname !== "/") return;
    try { if (!localStorage.getItem(KEY)) setTimeout(() => setStep(0), 900); } catch { /* storage diblokir */ }
  }, [capture]);

  useEffect(() => {
    if (step == null) { setBoxes([]); return; }
    const s = STEPS[step];
    const q = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(s.params ?? {})) { if (v == null) q.delete(k); else q.set(k, v); }
    const qs = q.toString();
    nav(s.path + (qs ? `?${qs}` : ""));
    app.openProfil(s.profil ?? null);
    setBoxes([]);

    let last = "", iv = 0;
    const find = () => s.targets.map((t) => document.querySelector(`[data-tour="${t}"]`)).filter((e): e is Element => !!e);
    // Ukur ulang saat halaman digulir/diubah ukurannya, plus cek ringan tiap 300 ms (grafik dan drawer selesai dimuat).
    const measure = () => {
      const bs = find().map((e) => {
        const r = e.getBoundingClientRect();
        return { x: Math.round(r.left - PAD), y: Math.round(r.top - PAD), w: Math.round(r.width + PAD * 2), h: Math.round(r.height + PAD * 2) };
      });
      const key = JSON.stringify(bs);
      if (key !== last) { last = key; setBoxes(bs); }
    };
    // Gulir sehingga area pertama terlihat di bawah bar filter yang menempel di atas.
    const scrollToFirst = (behavior: ScrollBehavior) => {
      const first = find()[0];
      if (!first || s.profil) return;
      const r = first.getBoundingClientRect();
      const top = r.height > innerHeight * 0.6 ? scrollY + r.top - 96 : scrollY + r.top - (innerHeight - r.height) / 2 + 40;
      scrollTo({ top: Math.max(0, top), behavior });
    };
    const t = setTimeout(() => { scrollToFirst("auto"); measure(); iv = window.setInterval(measure, 300); }, 400);
    // Ulangi sekali setelah data halaman (mis. data RS) selesai dimuat dan tinggi grafik berubah.
    const t2 = setTimeout(() => scrollToFirst("auto"), 1300);
    addEventListener("scroll", measure, { passive: true });
    addEventListener("resize", measure);
    return () => { clearTimeout(t); clearTimeout(t2); clearInterval(iv); removeEventListener("scroll", measure); removeEventListener("resize", measure); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const end = () => {
    setStep(null);
    app.openProfil(null);
    try { localStorage.setItem(KEY, "1"); } catch { /* abaikan */ }
  };
  const s = step != null ? STEPS[step] : null;
  const place = placeCard(boxes);
  return (
    <Ctx.Provider value={{ start: () => setStep(0) }}>
      {children}
      {s && step != null && (
        <>
          <Spotlight boxes={boxes} />
          <div className="tour" style={place} role="dialog" aria-label="Tur terpandu" aria-live="polite">
            <div className="tour-dots" aria-hidden>{STEPS.map((_, k) => <i key={k} className={k === step ? "on" : k < step ? "done" : ""} />)}</div>
            <p className="tour-head">{s.head}</p>
            <p className="tour-try"><b>Coba:</b> {s.try}</p>
            <div className="row">
              <button className="skip" onClick={end}>Tutup tur</button>
              <span>
                {step > 0 && <button className="skip" onClick={() => setStep(step - 1)}>Kembali</button>}
                <button className="next" onClick={() => (step + 1 < STEPS.length ? setStep(step + 1) : end())}>
                  {step + 1 < STEPS.length ? `Lanjut (${step + 1}/${STEPS.length})` : "Selesai"}
                </button>
              </span>
            </div>
          </div>
        </>
      )}
    </Ctx.Provider>
  );
}
