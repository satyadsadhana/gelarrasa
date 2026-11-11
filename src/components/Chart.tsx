import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { UI } from "../lib/theme";

const FONT = `${UI.fontBody ?? "'Fira Sans'"}, system-ui, sans-serif`;
const axis = {
  axisLine: { lineStyle: { color: "#cfcac0" } },
  axisTick: { lineStyle: { color: "#cfcac0" } },
  axisLabel: { color: UI.inkSoft, fontSize: 11 },
  splitLine: { lineStyle: { color: UI.line } },
  nameTextStyle: { color: UI.inkSoft, fontSize: 11 },
};
echarts.registerTheme("nn", {
  textStyle: { fontFamily: FONT, color: UI.ink },
  color: [UI.ink, UI.inkSoft],
  grid: { containLabel: true },
  categoryAxis: axis, valueAxis: axis, logAxis: axis, timeAxis: axis,
  legend: { textStyle: { color: UI.inkSoft, fontSize: 12 }, itemWidth: 14, itemHeight: 10 },
  tooltip: { backgroundColor: "#ffffff", borderColor: UI.line, textStyle: { color: UI.ink, fontSize: 12.5 }, extraCssText: "box-shadow:0 6px 20px rgba(0,0,0,.12);border-radius:8px;" },
  markLine: { label: { color: UI.inkSoft, fontSize: 11 } },
});

type Props = {
  option: EChartsOption;
  height?: number | string;
  onClick?: (p: echarts.ECElementEvent) => void;
  /** Dipanggil saat pengguna menggeser/zoom sumbu x: [indeks awal, indeks akhir]. */
  onZoom?: (range: [number, number]) => void;
  ariaLabel?: string;
};

export default function Chart({ option, height = 320, onClick, onZoom, ariaLabel }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  const zoomRef = useRef(onZoom);
  zoomRef.current = onZoom;

  useEffect(() => {
    const c = echarts.init(el.current!, "nn", { renderer: "canvas" });
    inst.current = c;
    c.on("click", (p) => clickRef.current?.(p));
    c.on("datazoom", () => {
      const dz = (c.getOption() as any).dataZoom?.[0];
      if (dz && dz.startValue != null) zoomRef.current?.([dz.startValue, dz.endValue]);
    });
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); c.dispose(); };
  }, []);

  useEffect(() => {
    inst.current?.setOption(
      { animationDuration: 500, textStyle: { fontFamily: FONT }, ...option } as EChartsOption,
      { notMerge: true },
    );
  }, [option]);

  return <div ref={el} role="img" aria-label={ariaLabel} style={{ width: "100%", height }} />;
}
