import type { HospitalDaily, ModelDampak } from "./types";
import { dateAt } from "./state";

export type Skenario = { jenis: "batas"; nilai: number } | { jenis: "kurangi"; persen: number };
export type SimRow = { outcome: string; key: string; aktual: number; skenario: number; selisih: number; persen: number };

export const apply = (s: Skenario, pm: number) => Math.max(1, s.jenis === "batas" ? Math.min(pm, s.nilai) : pm * (1 - s.persen / 100));

/** Faktor perubahan kasus satu hari (sama persis dengan simulasi_dampak() di notebook). */
export function factor(m: ModelDampak, hid: string, o: string, pmObs: number, pmNew: number) {
  const a = m.ambang[o];
  if (a && typeof a !== "string") {
    return Math.exp(a.b_log * (Math.log2(pmNew) - Math.log2(pmObs)) + (a.b_h * (Math.max(0, pmNew - a.T) - Math.max(0, pmObs - a.T))) / 100);
  }
  return Math.pow(pmNew / pmObs, m.b_per_rs[hid][o] / Math.LN2);
}

/** Jumlahkan kasus aktual vs skenario untuk sekumpulan RS dalam rentang tanggal [from, to]. */
export function simulate(h: HospitalDaily, m: ModelDampak, rsList: string[], s: Skenario, from: string, to: string): SimRow[] {
  const acc = Object.fromEntries(h.outcome.map((o) => [o, { a: 0, n: 0 }]));
  for (const hid of rsList) {
    const r = h.rs[hid];
    if (!r || !m.b_per_rs[hid]) continue;
    for (let i = 0; i < h.n; i++) {
      const pm = r.pm25[i];
      if (pm == null) continue;
      const d = dateAt(i, h.mulai);
      if (d < from || d > to) continue;
      const obs = Math.max(1, pm), nw = apply(s, obs);
      for (const o of h.outcome) {
        const y = r[o][i];
        if (y == null) continue;
        acc[o].a += y;
        acc[o].n += y * factor(m, hid, o, obs, nw);
      }
    }
  }
  return h.outcome.map((o) => ({ outcome: h.label[o], key: o, aktual: acc[o].a, skenario: acc[o].n, selisih: acc[o].n - acc[o].a, persen: acc[o].a ? 100 * (acc[o].n / acc[o].a - 1) : 0 }));
}
