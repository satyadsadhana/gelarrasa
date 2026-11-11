import { useEffect, useMemo, useState } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import Chart from "./Chart";
import { C, ISPU_COL, ISPU_LAB, ispuCat, MUTED, UI } from "../lib/theme";
import { fmt, UG } from "../lib/format";
import { useApp, usePick } from "../lib/state";

let geoState: "unknown" | "ok" | "none" = "unknown";
const geoPromise = () =>
  fetch("/data/indonesia.geojson")
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((g) => { echarts.registerMap("indonesia", g); geoState = "ok"; })
    .catch(() => { geoState = "none"; });

type Line = { a: string; b: string; label: string };
type Props = {
  values: Record<string, number | null>;
  visible?: (code: string) => boolean;
  height?: number;
  lines?: Line[];
  label?: string;
};

/** Peta 2D stasiun. Pakai batas wilayah dari /data/indonesia.geojson bila ada, kalau tidak sumbu lon/lat polos. */
export default function StationMap({ values, visible = () => true, height = 460, lines = [], label = "PM2.5" }: Props) {
  const { stations, openProfil } = useApp();
  const pick = usePick();
  const [geo, setGeo] = useState(geoState);
  useEffect(() => { if (geoState === "unknown") geoPromise().then(() => setGeo(geoState)); }, []);

  const option = useMemo<EChartsOption>(() => {
    const useGeo = geo === "ok";
    const coord = useGeo ? { coordinateSystem: "geo" as const } : { xAxisIndex: 0, yAxisIndex: 0 };
    const pts = stations.map((s) => {
      const v = values[s.code];
      const cat = ispuCat(v ?? null);
      const shown = visible(s.code);
      const ring = pick(s.code);
      return {
        name: s.code, value: [s.lon, s.lat, v],
        symbolSize: v == null ? 8 : Math.max(9, Math.min(46, 6 + Math.sqrt(v) * 2.4)),
        itemStyle: {
          color: !shown || v == null ? MUTED : ISPU_COL[cat], opacity: shown ? 0.9 : 0.25,
          borderColor: ring ?? "#fff", borderWidth: ring ? 3 : 1,
        },
        label: ring ? { show: true, formatter: s.nama, position: "right" as const, color: ring, fontWeight: 700, fontSize: 12, textBorderColor: "#fff", textBorderWidth: 3 } : undefined,
        z: ring ? 10 : 2,
        s,
      };
    });
    const byCode = Object.fromEntries(stations.map((s) => [s.code, s]));
    const lineData = lines.map((l) => ({ coords: [[byCode[l.a].lon, byCode[l.a].lat], [byCode[l.b].lon, byCode[l.b].lat]], name: l.label }));
    return {
      tooltip: {
        trigger: "item",
        formatter: (p: any) => {
          if (p.seriesType === "lines") return p.name;
          const s = p.data.s, v = p.data.value[2];
          const cat = ispuCat(v);
          return `<b>${s.nama}</b> · ${s.provinsi}<br/>${s.kelompok} · ${s.tipe ?? "—"}<br/>${label}: <b>${fmt(v)} ${UG}</b>${v != null ? ` (${ISPU_LAB[cat]})` : " (data tidak valid)"}<br/><i>Klik untuk profil stasiun</i>`;
        },
      },
      ...(useGeo
        ? { geo: { map: "indonesia", roam: true, center: [118, -2.5], zoom: 1.15, itemStyle: { areaColor: UI.mapLand, borderColor: "#ffffff", borderWidth: 0.7 }, emphasis: { disabled: true }, silent: true } }
        : {
            grid: { left: 8, right: 8, top: 8, bottom: 8 },
            xAxis: { type: "value", min: 94, max: 142, show: false },
            yAxis: { type: "value", min: -11.5, max: 6.5, show: false },
          }),
      series: [
        ...(lineData.length ? [{ type: "lines" as const, ...(useGeo ? { coordinateSystem: "geo" as const } : { coordinateSystem: "cartesian2d" as const }), data: lineData, lineStyle: { color: C.alert, width: 2.5, type: "dashed" as const }, z: 1 }] : []),
        { type: "scatter", ...coord, data: pts, label: { show: false }, emphasis: { scale: 1.2 }, animationDurationUpdate: 300 } as any,
      ],
    };
  }, [stations, values, visible, pick, geo, lines, label]);

  return (
    <div data-tour="map">
      <Chart option={option} height={height} onClick={(p: any) => p.data?.s && openProfil(p.data.s.code)} ariaLabel="Peta stasiun pemantau" />
      <div className="legend" style={{ marginTop: 4 }}>
        {ISPU_LAB.map((l, i) => <span key={l}><i style={{ background: ISPU_COL[i] }} />{l}</span>)}
        <span><i style={{ background: MUTED }} />Tidak valid / di luar filter</span>
        <span><i style={{ background: "#fff", border: `2.5px solid ${C.pick}`, borderRadius: 6 }} />Cincin = stasiun pilihan</span>
        {geo === "none" && <span style={{ color: C.alert }}>· Batas wilayah belum dimuat (indonesia.geojson)</span>}
      </div>
    </div>
  );
}
