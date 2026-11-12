import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import type { Station } from "./types";
import { PICK_COL, PICK_SYMBOL } from "./theme";

export const PERIODE = {
  semua: { label: "2024 – 14 Okt 2026", from: "2024-01-01", to: "2026-10-14" },
  "2024": { label: "2024", from: "2024-01-01", to: "2024-12-31" },
  "2025": { label: "2025", from: "2025-01-01", to: "2025-12-31" },
  "2026": { label: "2026 (s.d. 14 Okt)", from: "2026-01-01", to: "2026-10-14" },
  asap: { label: "Musim asap Jul–Okt", from: "2024-01-01", to: "2026-10-14", months: [7, 8, 9, 10] },
} as const;
export type PeriodeKey = keyof typeof PERIODE;
export const PULAU = ["Sumatera", "Jawa", "Kalimantan", "Sulawesi", "Papua"];
export const KAWASAN = ["Gambut", "Industri", "Roadside", "Urban", "Pesisir", "Latar Bersih"];
export const DEFAULT_PILIHAN = ["JKT-02", "KTG-01", "KTB-01"];
const PICK_KEY = "nn-pilihan";

/** Halaman mana yang memakai filter apa (sisanya dinonaktifkan + tooltip). */
export type FilterKey = "periode" | "pulau" | "kawasan" | "acuan";

type Ctx = {
  periode: PeriodeKey; pulau: string; kawasan: string; acuan: "nasional" | "who"; pilihan: string[];
  set: (k: string, v: string | null) => void;
  setPilihan: (codes: string[]) => void;
  togglePilihan: (code: string) => void;
  profil: string | null; openProfil: (code: string | null) => void;
  stations: Station[]; byCode: Record<string, Station>;
};
const C = createContext<Ctx | null>(null);

export function StateProvider({ stations, children }: { stations: Station[]; children: ReactNode }) {
  const [sp, setSp] = useSearchParams();
  const [profil, setProfil] = useState<string | null>(null);
  const byCode = useMemo(() => Object.fromEntries(stations.map((s) => [s.code, s])), [stations]);
  // Stasiun pilihan disimpan juga di luar URL, supaya tidak kembali ke pilihan awal
  // saat pengguna pindah halaman lewat menu (tautan menu tidak membawa query string).
  const [savedPick, setSavedPick] = useState<string | null>(() => {
    const q = new URLSearchParams(typeof location !== "undefined" ? location.search : "").get("pilih");
    if (q != null) { try { localStorage.setItem(PICK_KEY, q); } catch { /* storage diblokir */ } return q; }
    try { return localStorage.getItem(PICK_KEY); } catch { return null; }
  });
  const set = useCallback((k: string, v: string | null) => {
    if (k === "pilih") {
      setSavedPick(v);
      try { if (v == null) localStorage.removeItem(PICK_KEY); else localStorage.setItem(PICK_KEY, v); } catch { /* storage diblokir */ }
    }
    setSp((p) => { const n = new URLSearchParams(p); if (v == null || v === "") n.delete(k); else n.set(k, v); return n; }, { replace: true });
  }, [setSp]);
  const raw = sp.get("pilih") ?? savedPick;
  const pilihan = raw == null ? DEFAULT_PILIHAN : raw.split(",").filter((c) => byCode[c]).slice(0, 3);
  const setPilihan = useCallback((codes: string[]) => set("pilih", codes.slice(0, 3).join(",")), [set]);
  const togglePilihan = useCallback((code: string) => {
    if (pilihan.includes(code)) setPilihan(pilihan.filter((c) => c !== code));
    else if (pilihan.length < 3) setPilihan([...pilihan, code]);
    else setPilihan([...pilihan.slice(1), code]);
  }, [pilihan, setPilihan]);
  const periode = (sp.get("periode") as PeriodeKey) in PERIODE ? (sp.get("periode") as PeriodeKey) : "semua";
  const v: Ctx = {
    periode, pulau: sp.get("pulau") ?? "", kawasan: sp.get("kawasan") ?? "",
    acuan: sp.get("acuan") === "who" ? "who" : "nasional", pilihan, set, setPilihan, togglePilihan,
    profil, openProfil: setProfil, stations, byCode,
  };
  return <C.Provider value={v}>{children}</C.Provider>;
}

export function useApp() {
  const c = useContext(C);
  if (!c) throw new Error("StateProvider hilang");
  return c;
}

/** Warna slot stasiun pilihan (ungu, mawar, toska), atau null. */
export function usePick() {
  const { pilihan } = useApp();
  return (code: string) => { const i = pilihan.indexOf(code); return i < 0 ? null : PICK_COL[i]; };
}
/** Simbol ECharts untuk stasiun pilihan ke-i (● ◆ ▲), atau null. */
export function usePickSymbol() {
  const { pilihan } = useApp();
  return (code: string) => { const i = pilihan.indexOf(code); return i < 0 ? null : PICK_SYMBOL[i]; };
}

/** Predikat stasiun sesuai filter Wilayah & Kawasan. */
export function useStationFilter() {
  const { pulau, kawasan, byCode } = useApp();
  return (code: string) => {
    const s = byCode[code];
    if (!s) return false;
    return (!pulau || s.pulau === pulau) && (!kawasan || s.kelompok === kawasan);
  };
}

/** Indeks hari (dari 1 Jan 2024) yang masuk periode aktif. */
export function dayMask(periode: PeriodeKey, n: number, start = "2024-01-01") {
  const p = PERIODE[periode];
  const t0 = Date.parse(start + "T00:00:00Z");
  const out: boolean[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const d = new Date(t0 + i * 864e5);
    const iso = d.toISOString().slice(0, 10);
    let ok = iso >= p.from && iso <= p.to;
    if (ok && "months" in p) ok = (p.months as readonly number[]).includes(d.getUTCMonth() + 1);
    out[i] = ok;
  }
  return out;
}
export const dateAt = (i: number, start = "2024-01-01") => new Date(Date.parse(start + "T00:00:00Z") + i * 864e5).toISOString().slice(0, 10);
