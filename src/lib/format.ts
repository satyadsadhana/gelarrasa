const cache = new Map<number, Intl.NumberFormat>();
function nf(d: number) {
  if (!cache.has(d)) cache.set(d, new Intl.NumberFormat("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }));
  return cache.get(d)!;
}
/** Angka gaya Indonesia: koma desimal, titik ribuan. */
export const fmt = (v: number | null | undefined, d = 1) => (v == null || !isFinite(v) ? "–" : nf(d).format(v));
export const fmtPct = (v: number | null | undefined, d = 0, sign = false) =>
  v == null || !isFinite(v) ? "–" : `${sign && v > 0 ? "+" : ""}${fmt(v, d)}%`;
export const UG = "µg/m³";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
};
export const fmtMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${BULAN[m - 1]} ${y}`;
};
export { BULAN };
