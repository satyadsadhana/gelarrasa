/**
 * Token warna semantik. Aturan: SATU warna = SATU arti di seluruh dashboard.
 *
 *  STATUS   → hanya kategori ISPU resmi (Permen LHK 14/2020). Tidak dipakai untuk hal lain.
 *  GAMBUT   → oranye bakar: kawasan gambut / musim asap. Pembandingnya selalu abu (OTHER).
 *  FOCUS    → slate gelap: "ukuran yang sedang dibahas" bila bukan gambut & bukan status.
 *  PICK     → 3 slot Stasiun Pilihan: ungu, mawar, toska (+ simbol ● ◆ ▲). Hanya untuk stasiun pilihan.
 *  ALERT    → merah tua: masalah data yang tersembunyi.
 *  RAMP     → gradasi oranye untuk besaran berurutan gambut (tahun, kalender); TIER slate-teal untuk tangga WHO.
 *  UI       → hijau hutan hanya untuk kerangka (header, tombol, tautan), tidak untuk data.
 */
export const ISPU_LAB = ["Baik", "Sedang", "Tidak Sehat", "Sangat Tidak Sehat", "Berbahaya"] as const;
export const ISPU_COL = ["#2e9d3a", "#2f6fd6", "#f2c40f", "#d62728", "#1b1b1b"];
/** Warna teks yang terbaca di atas tiap warna ISPU (kontras ≥ 4,5:1). */
export const ISPU_ON = ["#18211c", "#ffffff", "#18211c", "#ffffff", "#ffffff"];
/** Batas konsentrasi PM2.5 24 jam per kategori ISPU (Permen LHK 14/2020). */
export const PM25_BP = [15.5, 55.4, 150.4, 250.4];
export const ispuCat = (pm: number | null) => {
  if (pm == null) return -1;
  let i = 0;
  while (i < PM25_BP.length && pm > PM25_BP[i]) i++;
  return i;
};

/** Palet: "now" = yang berlaku; "rek" & "alt" = kandidat (pratinjau lewat ?palet=rek / ?palet=alt). */
type Pal = {
  data: { gambut: string; gambutSoft: string; other: string; otherSoft: string; focus: string; alert: string; na: string; tipeSedang: string; tipeBersih: string };
  pick: string[]; ramp: string[];
  ui: { side: string; sideTx: string; sideSub: string; bg: string; surface2: string; ink: string; inkSoft: string; line: string; accent: string; accent2: string; mapLand: string;
    /** Opsional untuk tema halaman gelap: kartu, teks di atas latar, dan aksen 10%. */
    dark?: boolean; card?: string; onBg?: string; onBgSoft?: string; hi?: string; onHi?: string;
    /** Font & bentuk tombol (dari database ui-ux-pro-max). */
    fontHead?: string; fontBody?: string; fontNum?: string; radius?: string;
    /** Sidebar terang/gelap: warna item aktif, hover, garis tepi. */
    sideActiveBg?: string; sideActiveTx?: string; sideHover?: string; sideStrong?: string; sideEdge?: string };
};
/**
 * Palet data yang berlaku (klinis/inst/publik). Dipilih ulang 12 Nov dan diuji dengan
 * validator buta warna (skill dataviz, --pairs all): ungu/mawar/toska/oranye lolos
 * ΔE CVD ≥ 9 dan ΔE normal ≥ 15.
 *  - gambut = oranye bakar (asap/api), pembanding = abu dingin
 *  - focus  = slate-teal, serumpun warna kerangka, untuk satu ukuran tanpa kelompok
 *  - pick   = ungu ●, mawar ◆, toska ▲ (label teks tetap warna tinta)
 *  - alert  = merah tua, hanya untuk masalah data tersembunyi (selalu berlabel teks)
 *  - ramp   = gradasi oranye satu hue (tahun gambut, kalender)
 *  - tier   = gradasi slate-teal satu hue (tangga target WHO)
 */
const DATA_LIGHT = {
  data: { gambut: "#d4622a", gambutSoft: "#f2b896", other: "#9aa4ab", otherSoft: "#d5dadd", focus: "#2c5d6e", alert: "#b42318", na: "#e3e7ea", tipeSedang: "#8d989f", tipeBersih: "#c3cace" },
  pick: ["#6250d6", "#c0397a", "#1baf7a"],
  ramp: ["#fde9dc", "#f6c3a3", "#ee9a6c", "#d4622a", "#a8451a", "#6e2c10"],
};
/** Gradasi slate-teal untuk besaran berurutan yang bukan gambut (tangga WHO). Terang → gelap. */
export const TIER = ["#d3e4e9", "#a9c9d2", "#7aa8b6", "#4f8597", "#2c5d6e", "#163a47"];
const DATA_CREAM = {
  data: { gambut: "#794c20", gambutSoft: "#cfb197", other: "#a3a7ad", otherSoft: "#d5d8db", focus: "#50565c", alert: "#1a1d21", na: "#ddd8cc", tipeSedang: "#8e9398", tipeBersih: "#c0c5c9" },
  pick: ["#581b9d", "#1a8582", "#b05baa"],
  ramp: ["#f9ece1", "#e7cbb4", "#cba17d", "#95663a", "#794c20", "#482b0e"],
};
const PALETTES: Record<string, Pal> = {
  now: {
    data: { gambut: "#9a5b2e", gambutSoft: "#d9b99b", other: "#9aa3ab", otherSoft: "#d5d9dd", focus: "#34404c", alert: "#be185d", na: "#e4e1da", tipeSedang: "#8a949e", tipeBersih: "#c4cad0" },
    pick: ["#6d28d9", "#0e7490", "#18211c"],
    ramp: ["#f4ece1", "#e3cdb3", "#c9a27c", "#9a6a40", "#7d4f27", "#4e2d12"],
    ui: { side: "#1e4d3a", sideTx: "#d6e3da", sideSub: "#b8cbbf", bg: "#f7f5f0", surface2: "#f1eee7", ink: "#18211c", inkSoft: "#56615a", line: "#e2ddd2", accent: "#1e4d3a", accent2: "#2a6249", mapLand: "#e9e5dc" },
  },
  rek: {
    data: { gambut: "#794c20", gambutSoft: "#cfb197", other: "#a3a7ad", otherSoft: "#d5d8db", focus: "#50565c", alert: "#1a1d21", na: "#e2e1de", tipeSedang: "#8e9398", tipeBersih: "#c0c5c9" },
    pick: ["#581b9d", "#1a8582", "#cb73c4"],
    ramp: ["#f9ece1", "#e7cbb4", "#cba17d", "#95663a", "#794c20", "#482b0e"],
    ui: { side: "#1d2025", sideTx: "#c9cdd3", sideSub: "#9aa0a8", bg: "#f5f5f2", surface2: "#ececE8", ink: "#1a1d21", inkSoft: "#5b6068", line: "#e2e2dd", accent: "#1d2025", accent2: "#3a3f47", mapLand: "#e6e6e2" },
  },
  alt: {
    data: { gambut: "#794c20", gambutSoft: "#cfb197", other: "#a3a7ad", otherSoft: "#d5d8db", focus: "#50565c", alert: "#1a1d21", na: "#e2e1de", tipeSedang: "#8e9398", tipeBersih: "#c0c5c9" },
    pick: ["#581b9d", "#1a8582", "#cb73c4"],
    ramp: ["#f9ece1", "#e7cbb4", "#cba17d", "#95663a", "#794c20", "#482b0e"],
    ui: { side: "#15352a", sideTx: "#c9cdd3", sideSub: "#9aa0a8", bg: "#f4f5f1", surface2: "#eaede7", ink: "#16201b", inkSoft: "#56625b", line: "#dfe3dc", accent: "#1f4d3c", accent2: "#2b5f4b", mapLand: "#e5e7e1" },
  },
  navy: {
    ...DATA_CREAM,
    ui: { side: "#0f1d33", sideTx: "#d9dfea", sideSub: "#9fabc0", bg: "#14243f", surface2: "#ece3d2", ink: "#1a2233", inkSoft: "#535c6b", line: "#e0d6c3", accent: "#14243f", accent2: "#2d4a7a", mapLand: "#e6dccb",
      dark: true, card: "#f6efe2", onBg: "#f6efe2", onBgSoft: "#b9c2d3", hi: "#f2765c", onHi: "#14243f" },
  },
  forest: {
    ...DATA_CREAM,
    ui: { side: "#10261d", sideTx: "#dbe4dc", sideSub: "#a2b4a8", bg: "#163428", surface2: "#e4dac5", ink: "#1c2a22", inkSoft: "#56635a", line: "#d9cfba", accent: "#163428", accent2: "#2c5a45", mapLand: "#e0d6c0",
      dark: true, card: "#efe7d6", onBg: "#efe7d6", onBgSoft: "#a9bdb1", hi: "#c8ff3d", onHi: "#163428" },
  },
};
/* ---- kandidat dari database ui-ux-pro-max ---- */
PALETTES.inst = {
  ...DATA_LIGHT,
  ui: { side: "#1E3A5F", sideTx: "#dbe4f0", sideSub: "#9fb2cc", bg: "#F8FAFC", surface2: "#EEF2F7", ink: "#0F172A", inkSoft: "#475569", line: "#CBD5E1", accent: "#1E3A5F", accent2: "#2c5282", mapLand: "#e3e8ef",
    card: "#FFFFFF", hi: "#D97706", onHi: "#0F172A", fontHead: "'Lexend Variable'", fontBody: "'Source Sans 3 Variable'", radius: "6px" },
};
PALETTES.publik = {
  ...DATA_LIGHT,
  ui: { side: "#0F172A", sideTx: "#e2e8f0", sideSub: "#94a3b8", bg: "#F8FAFC", surface2: "#F1F5F9", ink: "#020617", inkSoft: "#475569", line: "#E2E8F0", accent: "#0F172A", accent2: "#334155", mapLand: "#e5e9ee",
    card: "#FFFFFF", fontHead: "'Figtree Variable'", fontBody: "'Noto Sans Variable'", radius: "8px" },
};
PALETTES.klinis = {
  ...DATA_LIGHT,
  ui: { side: "#164E63", sideTx: "#d6eef4", sideSub: "#9cc4cf", bg: "#F3FAFB", surface2: "#E6F2F4", ink: "#0C2B36", inkSoft: "#4A5F66", line: "#CFE3E8", accent: "#164E63", accent2: "#0E6A80", mapLand: "#e0ecef",
    card: "#FFFFFF", fontHead: "'Fira Sans'", fontBody: "'Fira Sans'", radius: "8px" },
};

/* ---- kandidat kerangka 12 Nov: netral supaya warna data yang menonjol ---- */
/** "Asap": arang berasap + latar abu hangat. Kerangka = asap, oranye data = api. */
PALETTES.asap = {
  ...DATA_LIGHT,
  ui: { side: "#202327", sideTx: "#d5d8dc", sideSub: "#a3a9b0", bg: "#f4f4f1", surface2: "#ebebe7", ink: "#1b1e22", inkSoft: "#575d64", line: "#e0e0db", accent: "#202327", accent2: "#3c424a", mapLand: "#e7e7e2",
    card: "#FFFFFF", fontHead: "'Fira Sans'", fontBody: "'Fira Sans'", radius: "8px",
    sideActiveBg: "#f4f4f1", sideActiveTx: "#1b1e22", sideHover: "rgba(255,255,255,0.07)", sideStrong: "#ffffff", sideEdge: "transparent" },
};
/** "Kertas": sidebar terang, latar kertas hangat, aksen tinta. Paling lapang. */
PALETTES.kertas = {
  ...DATA_LIGHT,
  ui: { side: "#fbfaf7", sideTx: "#3d434a", sideSub: "#6b7178", bg: "#f5f3ee", surface2: "#eeebe4", ink: "#1b1e22", inkSoft: "#575d64", line: "#e3dfd6", accent: "#1b1e22", accent2: "#3c424a", mapLand: "#ebe7de",
    card: "#FFFFFF", fontHead: "'Fira Sans'", fontBody: "'Fira Sans'", radius: "8px",
    sideActiveBg: "#1b1e22", sideActiveTx: "#ffffff", sideHover: "rgba(27,30,34,0.06)", sideStrong: "#1b1e22", sideEdge: "#e3dfd6" },
};
/** "Malam": biru malam + latar abu dingin. Paling formal/institusional. */
PALETTES.malam = {
  ...DATA_LIGHT,
  ui: { side: "#14233d", sideTx: "#d3dbe8", sideSub: "#9eacc2", bg: "#f3f5f8", surface2: "#e8ecf2", ink: "#121a28", inkSoft: "#4f5a6b", line: "#dce2ea", accent: "#14233d", accent2: "#2c4570", mapLand: "#e3e8ef",
    card: "#FFFFFF", fontHead: "'Fira Sans'", fontBody: "'Fira Sans'", radius: "8px",
    sideActiveBg: "#f3f5f8", sideActiveTx: "#121a28", sideHover: "rgba(255,255,255,0.08)", sideStrong: "#ffffff", sideEdge: "transparent" },
};

/** "Nusantara" (12 Nov, v3): kerangka biru-laut dalam serumpun panggung 3D, latar putih kebiruan, aksen toska.
 *  Toska hanya untuk kerangka (tombol, tautan, sorotan), tidak dipakai warna data. */
PALETTES.nusantara = {
  ...DATA_LIGHT,
  ui: { side: "#0b1d2a", sideTx: "#cfdde3", sideSub: "#8aa1ad", bg: "#eef3f4", surface2: "#e4ecee", ink: "#0d1a22", inkSoft: "#4d5f69", line: "#d7e1e4", accent: "#0b5563", accent2: "#0f7a86", mapLand: "#e0e9eb",
    card: "#FFFFFF", hi: "#2ec4b6", onHi: "#062026", fontHead: "'Fira Sans'", fontBody: "'Fira Sans'", radius: "10px",
    sideActiveBg: "#2ec4b6", sideActiveTx: "#062026", sideHover: "rgba(255,255,255,0.08)", sideStrong: "#ffffff", sideEdge: "transparent" },
};

function readKey() {
  if (typeof location === "undefined") return "";
  const q = new URLSearchParams(location.search).get("palet");
  try {
    if (q) sessionStorage.setItem("nn-palet", q);
    return q ?? sessionStorage.getItem("nn-palet") ?? "";
  } catch { return q ?? ""; }
}
const _key = readKey();
export const PAL_KEY = _key in PALETTES ? _key : "nusantara";
const PAL = PALETTES[PAL_KEY];
export const UI = PAL.ui;

/** Pasang warna kerangka ke CSS variables (dipanggil sekali di main.tsx). */
export function applyChrome() {
  const r = document.documentElement.style;
  const u = PAL.ui;
  const map: Record<string, string> = {
    "--bg": u.bg, "--surface-2": u.surface2, "--ink": u.ink, "--ink-soft": u.inkSoft, "--line": u.line,
    "--forest": u.accent, "--forest-2": u.accent2, "--side": u.side, "--side-tx": u.sideTx, "--side-sub": u.sideSub,
    "--gambut": PAL.data.gambut, "--pick": PAL.pick[0], "--alert": PAL.data.alert,
    "--surface": u.card ?? "#ffffff", "--on-bg": u.onBg ?? u.ink, "--on-bg-soft": u.onBgSoft ?? u.inkSoft,
    "--hi": u.hi ?? u.accent, "--on-hi": u.onHi ?? "#ffffff",
    "--font-head": `${u.fontHead ?? "'Fira Sans'"}, system-ui, sans-serif`,
    "--font-body": `${u.fontBody ?? "'Fira Sans'"}, system-ui, sans-serif`,
    "--font-num": `${u.fontNum ?? u.fontBody ?? "'Fira Sans'"}, system-ui, sans-serif`,
    "--btn-radius": u.radius ?? "10px",
    "--side-active-bg": u.sideActiveBg ?? "#f7f5f0", "--side-active-tx": u.sideActiveTx ?? u.accent,
    "--side-active-icon-bg": u.sideActiveBg ? u.sideActiveTx ?? u.side : u.side, "--side-active-icon-tx": u.sideActiveBg ? u.sideActiveBg : "#ffffff",
    "--side-hover": u.sideHover ?? "rgba(255,255,255,0.08)", "--side-strong": u.sideStrong ?? "#ffffff", "--side-edge": u.sideEdge ?? "transparent",
  };
  document.documentElement.classList.toggle("has-hi", !!u.hi);
  document.documentElement.classList.toggle("dark-page", !!u.dark);
  for (const [k, v] of Object.entries(map)) r.setProperty(k, v);
}

export const C = {
  ...PAL.data,
  pick: PAL.pick[0],
  ink: PAL.ui.ink,
  inkSoft: PAL.ui.inkSoft,
  grid: PAL.ui.line,
};
/** Gradasi oranye (terang → gelap) untuk besaran berurutan. */
export const RAMP = PAL.ramp;
export const YEAR_COL: Record<string, string> = { "2024": RAMP[2], "2025": RAMP[4], "2026": RAMP[5] };

export const GAMBUT_COL = { Gambut: C.gambut, "Non-gambut": C.other };
/** Tipe hasil clustering: hanya Episodik yang berwarna (cerita gambut), sisanya gradasi abu. */
export const TIPE_COL: Record<string, string> = {
  "Episodik (asap musiman)": C.gambut, "Kronis (tinggi & stabil)": C.focus, "Sedang & stabil": C.tipeSedang, "Latar bersih": C.tipeBersih,
};
/** Kawasan tidak diberi warna sendiri: gambut oranye, lainnya abu. Label teks yang membedakan. */
export const kawasanCol = (k: string) => (k === "Gambut" ? C.gambut : C.other);

/** Stasiun Pilihan: tiga warna slot yang tidak dipakai data lain, plus simbol. */
export const PICK_COL = PAL.pick;
export const PICK_SYMBOL = ["circle", "diamond", "triangle"] as const;
export const PICK_GLYPH = ["●", "◆", "▲"];
export const MUTED = C.na;
export const INK = C.ink;
export const INK_SOFT = C.inkSoft;

/** Gaya teks bawaan chart (ukuran minimum 11 px). */
export const AXIS = { color: C.inkSoft, fontSize: 11 };

/** Grade kualitas data: gradasi abu (A terang → E gelap). Bukan warna status; E sengaja abu tua, bukan hitam ISPU "Berbahaya". */
export const GRADE_STYLE: Record<string, { bg: string; fg: string }> = {
  A: { bg: "#e6ebe8", fg: "#18211c" }, B: { bg: "#d3d9dc", fg: "#18211c" }, C: { bg: "#b4bcc2", fg: "#18211c" },
  D: { bg: "#687278", fg: "#ffffff" }, E: { bg: "#4a5358", fg: "#ffffff" },
};
/** Temuan jaringan: hanya "tersembunyi" yang memakai warna alarm. */
export const KAT_COL: Record<string, string> = { Andal: C.other, "Diakui metadata": C.focus, "TERSEMBUNYI (status Active)": C.alert };
