import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmt, UG } from "../lib/format";
import { ISPU_COL, ISPU_LAB, ispuCat } from "../lib/theme";

/**
 * Visual kecil yang dipakai bersama: angka menghitung naik, titik, batang, garis, penggaris,
 * tiang, waffle, dan kotak partikel 3D. Semua animasi baru berjalan saat elemen terlihat di layar,
 * dan dimatikan bila pengguna memilih "kurangi gerakan".
 */

export const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** true sekali elemen masuk layar (tidak kembali false). */
export function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion() || typeof IntersectionObserver === "undefined") { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, on] as const;
}

/** Angka yang menghitung naik saat terlihat, dan bergeser halus saat filter mengubah nilainya. */
export function Count({ to, d = 0, dur = 1200 }: { to: number | null | undefined; d?: number; dur?: number }) {
  const [ref, on] = useInView<HTMLSpanElement>(0.4);
  const [v, setV] = useState(0);
  const cur = useRef(0);
  useEffect(() => {
    if (!on || to == null) return;
    if (reducedMotion()) { cur.current = to; setV(to); return; }
    const a = cur.current, b = to, t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const e = Math.min(1, (t - t0) / dur);
      const x = a + (b - a) * (1 - Math.pow(1 - e, 3));
      cur.current = x; setV(x);
      if (e < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, to, dur]);
  return <span ref={ref} className="count">{to == null ? "–" : fmt(v, d)}</span>;
}

/** Wadah yang memberi kelas "on" saat terlihat; anak-anaknya beranimasi lewat CSS. */
export function Reveal({ as: Tag = "div", className = "", children, threshold = 0.2, ...rest }: { as?: "div" | "section" | "ol" | "ul"; className?: string; children: ReactNode; threshold?: number; [k: string]: unknown }) {
  const [ref, on] = useInView<HTMLElement>(threshold);
  const T = Tag as "div";
  return <T ref={ref as never} className={`${className}${on ? " on" : ""}`} {...rest}>{children}</T>;
}

/** Jalur temuan: fakta-fakta tersambung satu garis rute yang tergambar saat terlihat. */
export function Flow({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <Reveal className="flow" aria-label={label} role="list" data-tour="kpis">
      {children}
    </Reveal>
  );
}

/* ---------------- visual mini (dipakai di dalam kartu fakta) ---------------- */

/** n titik menyala dari total. Untuk "21 dari 24 stasiun", "1 dari 6 hari". */
export function DotsViz({ n, total, tone = "alert", cols }: { n: number; total: number; tone?: "alert" | "gambut" | "focus"; cols?: number }) {
  return (
    <span className={`v-dots t-${tone}`} style={{ "--cols": cols ?? Math.min(total, 12) } as React.CSSProperties} aria-hidden>
      {Array.from({ length: total }, (_, i) => <i key={i} className={i < n ? "lit" : ""} style={{ "--k": i } as React.CSSProperties} />)}
    </span>
  );
}

/** Batang vertikal kecil yang tumbuh. Batang terakhir ditebalkan. */
export function BarsViz({ values, labels, tone = "gambut" }: { values: number[]; labels: string[]; tone?: "gambut" | "focus" | "alert" }) {
  const max = Math.max(...values, 1);
  return (
    <span className={`v-bars t-${tone}`} aria-hidden>
      {values.map((v, i) => (
        <span key={i} className={i === values.length - 1 ? "last" : ""} style={{ "--h": `${Math.max(6, (v / max) * 100)}%`, "--k": i } as React.CSSProperties}>
          <i /><small>{labels[i]}</small>
        </span>
      ))}
    </span>
  );
}

/** Dua garis dari "dulu" ke "sekarang": kelompok yang dibahas (oranye) vs pembanding (abu). */
export function SlopeViz({ a, b, la, lb, from, to }: { a: [number, number]; b: [number, number]; la: string; lb: string; from: string; to: string }) {
  const max = Math.max(...a, ...b) * 1.08, min = 0;
  const y = (v: number) => 46 - ((v - min) / (max - min)) * 40;
  return (
    <svg className="v-slope" viewBox="0 0 120 56" aria-hidden>
      <line x1="10" x2="10" y1="4" y2="48" className="ax" /><line x1="104" x2="104" y1="4" y2="48" className="ax" />
      <path d={`M10 ${y(b[0])} L104 ${y(b[1])}`} pathLength={1} className="cmp" />
      <path d={`M10 ${y(a[0])} L104 ${y(a[1])}`} pathLength={1} className="main" />
      <circle cx="104" cy={y(a[1])} r="3.2" className="main-dot" />
      <text x="10" y="55" className="lab">{from}</text><text x="104" y="55" textAnchor="end" className="lab">{to}</text>
      <text x="108" y={y(a[1]) + 3} className="lab main-t">{la}</text>
      <text x="108" y={y(b[1]) + 3} className="lab">{lb}</text>
    </svg>
  );
}

/** Penggaris: posisi nilai terhadap garis-garis batas. */
export function RulerViz({ value, max, marks }: { value: number; max: number; marks: { v: number; l: string }[] }) {
  const p = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <span className="v-ruler" aria-hidden>
      <span className="track" />
      {marks.map((m, k) => <span key={m.l} className={`mark${k % 2 ? "" : " up"}`} style={{ left: p(m.v) }}><small>{m.l}</small></span>)}
      <span className="needle" style={{ "--x": p(value) } as React.CSSProperties}><b>{fmt(value)}</b></span>
    </span>
  );
}

/** Tiang silinder (semu 3D, serupa tiang di peta) untuk membandingkan dua-tiga nilai; warna = kategori ISPU. */
export function PillarsViz({ items }: { items: { l: string; v: number }[] }) {
  const max = Math.max(...items.map((i) => i.v), 1);
  return (
    <span className="v-pillars" aria-hidden>
      {items.map((it, k) => (
        <span key={it.l} className="pillar" style={{ "--h": `${Math.max(8, (it.v / max) * 100)}%`, "--k": k, "--c": ISPU_COL[Math.max(0, ispuCat(it.v))] } as React.CSSProperties}>
          <i /><small>{it.l}</small>
        </span>
      ))}
    </span>
  );
}

/** Dua label yang saling bertentangan, mis. IKU "Baik" vs PM2.5 "Tidak Sehat". */
export function VersusViz({ left, right }: { left: { k: string; v: string }; right: { k: string; v: string } }) {
  return (
    <span className="v-versus" aria-hidden>
      <span className="ok"><small>{left.k}</small><b>{left.v}</b></span>
      <span className="vs">vs</span>
      <span className="bad"><small>{right.k}</small><b>{right.v}</b></span>
    </span>
  );
}

/** Pita 52 minggu; minggu berisiko diberi warna. */
export function WeeksViz({ from, to, label }: { from: number; to: number; label: string }) {
  return (
    <span className="v-weeks" aria-hidden>
      <span className="row">{Array.from({ length: 52 }, (_, i) => <i key={i} className={i + 1 >= from && i + 1 <= to ? "lit" : ""} style={{ "--k": i } as React.CSSProperties} />)}</span>
      <span className="lab"><small>Jan</small><small>{label}</small><small>Des</small></span>
    </span>
  );
}

/* ---------------- waffle 10 × 10 ---------------- */

/** Pembulatan "sisa terbesar" supaya jumlah kotak tepat 100. */
export function toHundred(parts: number[]) {
  const tot = parts.reduce((a, b) => a + b, 0) || 1;
  const raw = parts.map((p) => (p / tot) * 100);
  const fl = raw.map(Math.floor);
  let rest = 100 - fl.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - fl[i], i] as const).sort((x, y) => y[0] - x[0]).forEach(([, i]) => { if (rest > 0) { fl[i]++; rest--; } });
  return fl;
}

export function Waffle({ parts, colors, labels }: { parts: number[]; colors: string[]; labels: string[] }) {
  const h = toHundred(parts);
  const cells: number[] = [];
  h.forEach((n, i) => { for (let k = 0; k < n; k++) cells.push(i); });
  return (
    <Reveal className="waffle" role="img" aria-label={labels.map((l, i) => `${l} ${h[i]}%`).join(", ")}>
      {cells.map((c, k) => <i key={k} title={`${labels[c]}: ${h[c]} dari 100`} style={{ "--c": colors[c], "--k": k } as React.CSSProperties} />)}
    </Reveal>
  );
}

/* ---------------- kotak partikel 3D ---------------- */

const ISPU_RGB = ["46,157,58", "47,111,214", "242,196,15", "214,39,40", "160,22,79"];

/**
 * Satu meter kubik udara: tiap titik = 1 µg PM2.5 (dibatasi 900 titik). Kubus berputar pelan,
 * partikel melayang; warna mengikuti kategori ISPU nilai tersebut.
 */
export function ParticleBox({ value, title, sub, perDot = 1, size = 220 }: { value: number | null; title: ReactNode; sub?: ReactNode; perDot?: number; size?: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [wrap, on] = useInView<HTMLDivElement>(0.15);
  const target = value == null ? 0 : Math.min(900, Math.round(value / perDot));
  const tRef = useRef(target);
  tRef.current = target;
  const cat = ispuCat(value);
  const rgb = cat < 0 ? "120,130,140" : ISPU_RGB[cat];
  const rgbRef = useRef(rgb);
  rgbRef.current = rgb;

  useEffect(() => {
    const c = cv.current;
    if (!c || !on) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = size * dpr; c.height = size * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    type P = { x: number; y: number; z: number; vx: number; vy: number; vz: number; a: number };
    const ps: P[] = [];
    const rnd = () => Math.random() * 2 - 1;
    const add = () => ps.push({ x: rnd(), y: rnd(), z: rnd(), vx: rnd() * 0.002, vy: rnd() * 0.002, vz: rnd() * 0.002, a: 0 });
    let ang = 0.6, raf = 0, visible = true;
    const still = reducedMotion();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(c);
    const corners = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z] as const)));
    const edges: [number, number][] = [];
    corners.forEach((a, i) => corners.forEach((b, j) => { if (j > i && [0, 1, 2].filter((k) => a[k] !== b[k]).length === 1) edges.push([i, j]); }));
    const proj = (x: number, y: number, z: number) => {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const rx = x * ca - z * sa, rz = x * sa + z * ca;
      const ry = y * 0.94 - rz * 0.34, rz2 = y * 0.34 + rz * 0.94;
      const s = 3.4 / (3.4 + rz2);
      return { X: size / 2 + rx * s * size * 0.3, Y: size / 2 + ry * s * size * 0.3, s, d: rz2 };
    };
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const want = tRef.current;
      for (let k = 0; k < 12 && ps.length < want; k++) add();
      if (ps.length > want) ps.splice(want, Math.min(14, ps.length - want));
      if (!still) ang += 0.0035;
      g.clearRect(0, 0, size, size);
      // sisi belakang kubus
      g.lineWidth = 1;
      edges.forEach(([i, j]) => {
        const a = proj(...corners[i]), b = proj(...corners[j]);
        g.strokeStyle = `rgba(160,200,212,${a.d + b.d > 0 ? 0.18 : 0.42})`;
        g.beginPath(); g.moveTo(a.X, a.Y); g.lineTo(b.X, b.Y); g.stroke();
      });
      const col = rgbRef.current;
      const drawn = ps.map((p) => {
        if (!still) {
          p.x += p.vx; p.y += p.vy; p.z += p.vz;
          p.vx += rnd() * 0.0004; p.vy += rnd() * 0.0004 - 0.00002; p.vz += rnd() * 0.0004;
          p.vx *= 0.99; p.vy *= 0.99; p.vz *= 0.99;
          (["x", "y", "z"] as const).forEach((k) => { if (Math.abs(p[k]) > 0.96) { p[k] = Math.sign(p[k]) * 0.96; const v = (`v${k}`) as "vx"; p[v] *= -1; } });
        }
        p.a = Math.min(1, p.a + 0.04);
        return { p, q: proj(p.x, p.y, p.z) };
      }).sort((m, n) => n.q.d - m.q.d);
      drawn.forEach(({ p, q }) => {
        g.fillStyle = `rgba(${col},${(0.35 + 0.55 * (1 - (q.d + 1) / 2)) * p.a})`;
        g.beginPath(); g.arc(q.X, q.Y, 1.1 + 1.6 * q.s, 0, Math.PI * 2); g.fill();
      });
    };
    frame();
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [on, size]);

  return (
    <div className="pbox" ref={wrap}>
      <canvas ref={cv} style={{ width: "100%", maxWidth: size, aspectRatio: "1 / 1", height: "auto" }} aria-hidden />
      <div className="pbox-cap">
        <b>{value == null ? "–" : <Count to={value} d={0} />} <small>{UG}</small></b>
        <span className="pbox-t">{title}</span>
        {sub && <span className="pbox-s">{sub}</span>}
        {cat >= 0 && <span className="pbox-cat" style={{ background: ISPU_COL[cat], color: cat === 2 || cat === 0 ? "#18211c" : "#fff" }}>{ISPU_LAB[cat]}</span>}
      </div>
    </div>
  );
}

/* ---------------- info pop-up ---------------- */

/** Tombol ⓘ kecil yang membuka penjelasan cara hitung. */
export function InfoTip({ title = "Cara Menghitung", children }: { title?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <span className="info" ref={ref}>
      <button type="button" aria-expanded={open} aria-label={title} onClick={() => setOpen((o) => !o)}>i</button>
      {open && <span className="info-pop" role="dialog" aria-label={title}><b>{title}</b>{children}</span>}
    </span>
  );
}
