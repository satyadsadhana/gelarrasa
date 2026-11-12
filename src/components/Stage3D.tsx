import { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { FlyToInterpolator, LightingEffect, AmbientLight, DirectionalLight, type LayersList, type MapViewState, type PickingInfo } from "@deck.gl/core";
import { ColumnLayer, GeoJsonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { useApp } from "../lib/state";
import { ispuCat, ISPU_LAB, PICK_COL } from "../lib/theme";
import { fmt, UG } from "../lib/format";


/**
 * Panggung 3D: daratan Indonesia + satu tiang cahaya per stasiun.
 * Tinggi tiang = PM2.5, warna = kategori ISPU. Satu komponen dipakai semua halaman; tiap halaman
 * memilih sudut kamera (VIEWS) dan nilai yang ditampilkan.
 */

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** ISPU di atas latar gelap: "Berbahaya" (hitam resmi) diganti merah marun supaya tetap terlihat; legenda ikut warna ini. */
export const ISPU_3D: RGB[] = [hex("#3ccf6e"), hex("#4b8df8"), hex("#f6c945"), hex("#f0483e"), hex("#a0164f")];
const NA: RGB = [86, 104, 116];

export const VIEWS: Record<string, MapViewState> = {
  nasional: { longitude: 110.6, latitude: -0.9, zoom: 4.15, pitch: 55, bearing: -10 },
  barat: { longitude: 107.5, latitude: 2.4, zoom: 4.25, pitch: 50, bearing: 10 },
  kalimantan: { longitude: 113.4, latitude: 0.2, zoom: 4.85, pitch: 55, bearing: -20 },
  jawa: { longitude: 108.5, latitude: -6.6, zoom: 5.4, pitch: 58, bearing: 8 },
  rendah: { longitude: 117, latitude: -1.2, zoom: 3.7, pitch: 48, bearing: -6 },
};

let geoCache: Promise<unknown> | null = null;
const loadGeo = () => (geoCache ??= fetch("/data/indonesia.geojson").then((r) => (r.ok ? r.json() : null)).catch(() => null));

/** Cek dukungan WebGL SEKALI saja; konteks uji langsung dilepas supaya tidak memakan jatah konteks browser. */
let _webgl: boolean | null = null;
function webglOk() {
  if (_webgl != null) return _webgl;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    _webgl = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch { _webgl = false; }
  return _webgl;
}
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const lighting = new LightingEffect({
  ambient: new AmbientLight({ color: [255, 255, 255], intensity: 1.15 }),
  key: new DirectionalLight({ color: [255, 236, 214], intensity: 1.6, direction: [-3, -6, -4] }),
  fill: new DirectionalLight({ color: [120, 190, 255], intensity: 0.6, direction: [4, 3, -2] }),
});

type Props = {
  values: Record<string, number | null>;
  view?: keyof typeof VIEWS | MapViewState;
  visible?: (code: string) => boolean;
  height?: number | string;
  /** Batas atas skenario (Simulasi): bagian tiang di atas nilai ini tampil sebagai bayangan. */
  cap?: number | null;
  /** Kode yang diberi label nama di atas tiang (default: stasiun pilihan). */
  labels?: string[];
  autoRotate?: boolean;
  fallback?: React.ReactNode;
  caption?: React.ReactNode;
};

const ELEV = 4200; // meter per µg/m³
// Harus konstanta modul: fungsi default baru tiap render mengubah updateTriggers tiap frame,
// sehingga transisi tinggi tiang dimulai ulang dari nol terus dan tiang tidak pernah naik.
const ALL = () => true;

export default function Stage3D({ values, view = "nasional", visible = ALL, height = 460, cap = null, labels, autoRotate = false, fallback, caption }: Props) {
  const { stations, pilihan, openProfil } = useApp();
  const [geo, setGeo] = useState<unknown>(null);
  const [ok] = useState(webglOk);
  const base = typeof view === "string" ? VIEWS[view] : view;
  // layar sempit: mundurkan kamera supaya seluruh pulau tetap terlihat
  const narrow = typeof innerWidth !== "undefined" ? Math.max(-1.3, Math.log2(Math.min(1, innerWidth / 1180))) : 0;
  const target = { ...base, zoom: base.zoom + narrow };
  const [vs, setVs] = useState<MapViewState>({ ...target, zoom: target.zoom - 0.6, pitch: 10, bearing: (target.bearing ?? 0) - 20 });
  // 0 lalu 1 setelah deck siap (onLoad, WebGL dibuat async) + jeda fade halaman: tiang tumbuh lewat transisi deck.gl
  const [grow, setGrow] = useState(reduced() ? 1 : 0);
  const growT = useRef(0);
  useEffect(() => () => clearTimeout(growT.current), []);
  const [pulse, setPulse] = useState(0);
  const interacting = useRef(false);
  // Lepas konteks WebGL saat peta benar-benar dicopot (pindah halaman / tutup tur). Tanpa ini konteks lama
  // menumpuk, browser mematikan yang tertua (kotak abu-abu) lalu membuat ulang peta (terasa jeda).
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    return () => {
      const canvases = el ? [...el.querySelectorAll("canvas")] : [];
      setTimeout(() => {
        if (el?.isConnected) return; // StrictMode (mode pengembangan) hanya pura-pura mencopot
        canvases.forEach((c) => { try { (c.getContext("webgl2") as WebGL2RenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext(); } catch { /* abaikan */ } });
      }, 0);
    };
  }, []);

  useEffect(() => { loadGeo().then(setGeo); }, []);
  // kamera terbang ke sudut halaman (juga saat pertama tampil)
  useEffect(() => {
    setVs({ ...target, transitionDuration: reduced() ? 0 : 2200, transitionInterpolator: new FlyToInterpolator({ speed: 1.2 }) });
  }, [target.longitude, target.latitude, target.zoom, target.pitch, target.bearing]); // eslint-disable-line react-hooks/exhaustive-deps

  // denyut asap + putar pelan (berhenti saat pengguna menggeser)
  useEffect(() => {
    if (reduced()) return;
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => {
      const e = (t - t0) / 1600;
      setPulse((t / 1000) % 1);
      if (autoRotate && !interacting.current && e > 1.6) setVs((v) => ({ ...v, bearing: (v.bearing ?? 0) + 0.035, transitionDuration: 0 }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate]);

  const data = useMemo(() => stations.filter((s) => !s.dikecualikan).map((s) => {
    const v = values[s.code] ?? null;
    const shown = visible(s.code);
    const cat = ispuCat(v);
    return { s, v, shown, cat };
  }), [stations, values, visible]);
  type D = (typeof data)[number];
  const lab = labels ?? pilihan;
  // Di-memo: array baru tiap frame (render denyut) membuat transisi deck.gl mulai ulang dari nol terus.
  const over = useMemo(() => (cap == null ? [] : data.filter((d) => d.shown && (d.v ?? 0) > cap)), [data, cap]);
  const named = useMemo(() => data.filter((d) => lab.includes(d.s.code)), [data, lab.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ok) return <>{fallback ?? null}</>;

  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const rise = { duration: reduced() ? 0 : 1500, easing: ease };
  const capped = (v: number | null) => (v == null ? 0 : cap != null ? Math.min(v, cap) : v);
  const colFor = (d: D): [number, number, number, number] => {
    if (!d.shown || d.v == null) return [...NA, 90];
    return [...ISPU_3D[ispuCat(capped(d.v))], 245];
  };

  const layers = [
    geo && new GeoJsonLayer({
      id: "darat", data: geo as never, extruded: true, filled: true, stroked: true, wireframe: false,
      getElevation: 9000, getFillColor: [34, 66, 82, 255], getLineColor: [120, 200, 215, 150], lineWidthMinPixels: 0.6,
      material: { ambient: 0.5, diffuse: 0.6, shininess: 8 },
    }),
    // cahaya di kaki tiang: makin pekat makin lebar; berdenyut bila Sangat Tidak Sehat ke atas
    new ScatterplotLayer<D>({
      id: "kaki", data: data.filter((d) => d.shown && d.v != null),
      getPosition: (d) => [d.s.lon, d.s.lat, 9500], radiusUnits: "meters",
      getRadius: (d) => 22000 + Math.min(d.v ?? 0, 400) * 260 * (d.cat >= 3 ? 1 + 0.35 * Math.sin(pulse * Math.PI * 2) : 1),
      getFillColor: (d) => [...ISPU_3D[d.cat], d.cat >= 3 ? 70 : 38],
      updateTriggers: { getRadius: [pulse] }, parameters: { depthWriteEnabled: false },
    }),
    // bayangan bagian yang "dipotong" skenario Simulasi
    cap != null && new ColumnLayer<D>({
      id: "potong", data: over, diskResolution: 24, radius: 21000, extruded: true,
      getPosition: (d) => [d.s.lon, d.s.lat, 9000], getElevation: (d) => (d.v ?? 0) * ELEV * grow,
      getFillColor: [255, 255, 255, 28], getLineColor: [255, 255, 255, 120], stroked: false, wireframe: true,
      transitions: { getElevation: { ...rise, enter: () => [0] } },
      updateTriggers: { getElevation: [grow, values] }, parameters: { depthWriteEnabled: false },
    }),
    new ColumnLayer<D>({
      id: "tiang", data, diskResolution: 24, radius: 21000, extruded: true, pickable: true, autoHighlight: true,
      highlightColor: [255, 255, 255, 90],
      getPosition: (d) => [d.s.lon, d.s.lat, 9000],
      getElevation: (d) => (d.shown ? capped(d.v) : 4) * ELEV * grow,
      getFillColor: colFor,
      material: { ambient: 0.55, diffuse: 0.55, shininess: 40, specularColor: [255, 255, 255] },
      transitions: { getElevation: rise, getFillColor: { duration: 500 } },
      updateTriggers: { getElevation: [grow, values, cap, visible], getFillColor: [values, visible, cap] },
      onClick: (i: PickingInfo<D>) => { if (i.object) openProfil(i.object.s.code); },
    }),
    new ScatterplotLayer<D>({
      id: "cincin", data: data.filter((d) => lab.includes(d.s.code)), stroked: true, filled: false,
      getPosition: (d) => [d.s.lon, d.s.lat, 9500], radiusUnits: "meters", getRadius: 30000, lineWidthMinPixels: 2,
      getLineColor: (d) => [...hex(PICK_COL[pilihan.indexOf(d.s.code)] ?? "#ffffff"), 255],
    }),
    new TextLayer<D>({
      id: "nama", data: named,
      getPosition: (d) => [d.s.lon, d.s.lat, 9000 + capped(d.v) * ELEV * grow + 30000],
      getText: (d) => `${d.s.nama}${d.v != null ? ` · ${fmt(d.v, 0)}` : ""}`,
      getSize: 13, getColor: [240, 246, 248, 255], fontWeight: 600, fontFamily: "Plus Jakarta Sans Variable, system-ui, sans-serif",
      background: true, getBackgroundColor: [10, 24, 34, 200], backgroundPadding: [6, 3],
      characterSet: "auto", billboard: true, getTextAnchor: "middle", getAlignmentBaseline: "bottom",
      updateTriggers: { getPosition: [grow, values, cap] },
    }),
  ].filter(Boolean);

  const tip = ({ object }: PickingInfo<D>) => object && {
    html: `<b>${object.s.nama}</b><br/>${object.s.provinsi}<br/>${object.v == null ? "data tidak valid" : `PM2.5 ${fmt(object.v, 1)} ${UG} · ${ISPU_LAB[object.cat]}`}`,
    style: { background: "rgba(10,24,34,.92)", color: "#eef4f6", fontSize: "12px", borderRadius: "8px", padding: "8px 10px", fontFamily: "Plus Jakarta Sans Variable, system-ui, sans-serif" },
  };

  return (
    <div className="stage3d" style={{ height }} ref={box}>
      <DeckGL
        viewState={vs}
        onLoad={() => { growT.current = window.setTimeout(() => setGrow(1), 350); }}
        onViewStateChange={({ viewState, interactionState }) => {
          interacting.current = !!(interactionState?.isDragging || interactionState?.isRotating || interactionState?.isZooming) || interacting.current;
          setVs(viewState as MapViewState);
        }}
        controller={{ scrollZoom: false, dragRotate: true, touchRotate: true, inertia: true }}
        layers={layers as LayersList}
        effects={[lighting]}
        getTooltip={tip as never}
        getCursor={({ isHovering, isDragging }) => (isDragging ? "grabbing" : isHovering ? "pointer" : "grab")}
      />
      <div className="stage-legend" aria-hidden>
        {ISPU_LAB.map((l, i) => <span key={l}><i style={{ background: `rgb(${ISPU_3D[i].join(",")})` }} />{l}</span>)}
      </div>
      <button className="stage-reset" onClick={() => { interacting.current = false; setVs({ ...target, transitionDuration: 1200, transitionInterpolator: new FlyToInterpolator() }); }}>
        ⟲ Sudut awal
      </button>
      {caption && <div className="stage-caption">{caption}</div>}
    </div>
  );
}

