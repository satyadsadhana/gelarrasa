import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import Chart from "../components/Chart";
import { Card, Kpi, Page, Seg } from "../components/Layout";
import { useData } from "../lib/data";
import { fmt, fmtDate, fmtPct, UG } from "../lib/format";
import type { HospitalDaily } from "../lib/types";
import { dateAt, useApp } from "../lib/state";
import { C, ISPU_COL, PICK_COL, PICK_GLYPH, PICK_SYMBOL } from "../lib/theme";

type Dose = { kategori: string[]; hari_rs: number[]; gabungan: Record<string, number[]>; per_rs: Record<string, { hari: number[] } & Record<string, (number | null)[]>> };
type RR = { gabungan: Record<string, { rr: number; lo: number; hi: number; I2: number; k: number }> };
type Lag = { satu_lag: { outcome: string; lag: number; RR: number; lo: number; hi: number }[]; gabungan: { outcome: string; variabel: string; RR: number; "CI bawah": number; "CI atas": number }[] };
type Age = { rr_balita: number; rr_lansia: number; ci_balita: number[]; ci_lansia: number[]; p_beda: number; total_kasus: Record<string, number> };
type Eco = { rho: number; dipakai: string[]; data: { hospital_id: string; code: string; pm25: number; resp_per100: number }[] };

const OUT = ["ISPA balita", "ISPA lansia", "Darurat asma", "PPOK", "Rawat napas umum", "Kardiovaskular", "Kematian"];

export default function Q4Dampak() {
  const d = useData<[Dose, RR, Lag, Age, Eco, HospitalDaily]>("dose_response", "rr", "lag", "age", "ecological", "hospital_daily");
  const { pilihan, byCode } = useApp();
  const [out, setOut] = useState("Kematian");
  const [tsOut, setTsOut] = useState("ISPA balita");

  /** Rata-rata mingguan PM2.5 dan kasus (relatif terhadap rata-rata RS itu) untuk RS pasangan Stasiun Pilihan. */
  const weekly = useMemo(() => {
    if (!d) return null;
    const h = d[5];
    const nW = Math.ceil(h.n / 7);
    const weeks = Array.from({ length: nW }, (_, w) => dateAt(w * 7));
    const rows = pilihan.map((c, slot) => {
      const hid = byCode[c]?.hospital_id;
      const r = hid ? h.rs[hid] : undefined;
      const key = h.outcome.find((o) => h.label[o] === tsOut);
      if (!r || !key || !r[key]) return null;
      const ys = r[key] as (number | null)[];
      const all = ys.filter((v): v is number => v != null);
      const base = all.reduce((a, b) => a + b, 0) / all.length;
      const pm: (number | null)[] = [], y: (number | null)[] = [];
      for (let w = 0; w < nW; w++) {
        let sp = 0, kp = 0, sy = 0, ky = 0;
        for (let i = w * 7; i < Math.min(h.n, w * 7 + 7); i++) {
          if (r.pm25[i] != null) { sp += r.pm25[i]!; kp++; }
          if (ys[i] != null) { sy += ys[i]!; ky++; }
        }
        pm.push(kp >= 4 ? sp / kp : null); y.push(ky >= 4 ? sy / ky / base : null);
      }
      return { c, slot, pm, y };
    }).filter((x): x is NonNullable<typeof x> => x != null);
    return { weeks, rows };
  }, [d, pilihan, byCode, tsOut]);
  const [lagMode, setLagMode] = useState<"satu" | "gabung">("gabung");
  const [lagOut, setLagOut] = useState("ISPA balita");
  if (!d) return <div className="loading">Memuat data rumah sakit dan model dampak…</div>;
  const [dose, rr, lag, age, eco] = d;
  const wk = weekly!;

  const doseOpt: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: any) => (v == null ? "–" : `${fmt(v, 2)}× hari biasa`) },
    legend: { bottom: 0 }, grid: { left: 8, right: 14, top: 24, bottom: 40 },
    xAxis: { type: "category", data: dose.kategori.map((k, i) => `${k}\n${fmt(dose.hari_rs[i], 0)} hari-RS`),
      axisLabel: { color: C.ink, fontWeight: 600, lineHeight: 16, fontSize: 12 } },
    yAxis: { type: "value", name: "× rata-rata RS sendiri", min: 0 },
    series: [
      { name: "25 RS (gabungan)", type: "bar", barWidth: "46%", data: dose.gabungan[out].map((v, i) => ({ value: v, itemStyle: { color: ISPU_COL[i] } })),
        label: { show: true, position: "top", formatter: (p: any) => `${fmt(p.value, 1)}×`, fontWeight: 700 },
        markLine: { silent: true, symbol: "none", lineStyle: { color: C.inkSoft, type: "dashed" }, label: { formatter: "1 = hari biasa", position: "insideEndTop" }, data: [{ yAxis: 1 }] } },
      ...pilihan.map((c, i) => {
        const hid = byCode[c].hospital_id;
        const pr = dose.per_rs[hid];
        return { name: `${byCode[c].nama}`, type: "scatter" as const, symbol: PICK_SYMBOL[i], symbolSize: 13, itemStyle: { color: PICK_COL[i], borderColor: "#fff", borderWidth: 1.5 },
          data: pr ? pr[out].map((v, k) => (pr.hari[k] >= 10 ? v : null)) : [] };
      }),
    ],
  };

  const lagRows = lagMode === "satu"
    ? lag.satu_lag.filter((r) => r.outcome === lagOut).map((r) => ({ x: r.lag < 0 ? `+${-r.lag} sesudah` : r.lag === 0 ? "hari sama" : `${r.lag} hr sblm`, rr: r.RR, lo: r.lo, hi: r.hi, plasebo: r.lag < 0 }))
    : lag.gabungan.filter((r) => r.outcome === lagOut).map((r) => ({ x: r.variabel.replace("plasebo +", "+").replace("lag 0", "hari sama").replace(/^\+(\d)/, "+$1 sesudah").replace(/^lag (\d)/, "$1 hr sblm"), rr: r.RR, lo: r["CI bawah"], hi: r["CI atas"], plasebo: r.variabel.startsWith("plasebo") }));
  if (lagMode === "gabung") lagRows.sort((a, b) => (a.plasebo === b.plasebo ? 0 : a.plasebo ? -1 : 1));
  const lagOpt: EChartsOption = {
    tooltip: { trigger: "axis", formatter: (p: any) => { const r = lagRows[p[0].dataIndex]; return `${r.x}<br/>RR <b>${fmt(r.rr, 3)}</b> (${fmt(r.lo, 2)}–${fmt(r.hi, 2)})`; } },
    grid: { left: 8, right: 10, top: 14, bottom: 30 },
    xAxis: { type: "category", data: lagRows.map((r) => r.x), axisLabel: { fontSize: 10, interval: 0, rotate: lagRows.length > 7 ? 30 : 0 } },
    yAxis: { type: "value", name: "RR per lipat dua", min: (v: any) => Math.min(0.9, Math.floor(v.min * 20) / 20) },
    series: [
      { type: "bar", data: lagRows.map((r) => ({ value: r.rr, itemStyle: { color: r.plasebo ? C.otherSoft : C.focus } })),
        markLine: { silent: true, symbol: "none", lineStyle: { color: C.inkSoft }, label: { show: false }, data: [{ yAxis: 1 }] } },
      { type: "custom", renderItem: (_p: any, api: any) => {
          const x = api.value(0), lo = api.coord([x, api.value(1)]), hi = api.coord([x, api.value(2)]);
          return { type: "group", children: [{ type: "line", shape: { x1: lo[0], y1: lo[1], x2: hi[0], y2: hi[1] }, style: { stroke: "#1f2a24", lineWidth: 1 } },
            { type: "line", shape: { x1: lo[0] - 4, y1: lo[1], x2: lo[0] + 4, y2: lo[1] }, style: { stroke: "#1f2a24" } },
            { type: "line", shape: { x1: hi[0] - 4, y1: hi[1], x2: hi[0] + 4, y2: hi[1] }, style: { stroke: "#1f2a24" } }] };
        }, data: lagRows.map((r, i) => [i, r.lo, r.hi]), z: 5, tooltip: { show: false } } as any,
    ],
  };

  const ageOpt: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: [{ left: 8, right: "55%", top: 26, bottom: 10, containLabel: true }, { left: "55%", right: 30, top: 26, bottom: 10, containLabel: true }],
    title: [{ text: "Kenaikan risiko per lipat dua", left: "4%", top: 0, textStyle: { fontSize: 11.5, fontWeight: 600 } }, { text: "Total kasus 2024–2026", left: "56%", top: 0, textStyle: { fontSize: 11.5, fontWeight: 600 } }],
    xAxis: [{ type: "value", gridIndex: 0, show: false, max: 70 }, { type: "value", gridIndex: 1, show: false }],
    yAxis: [{ type: "category", gridIndex: 0, data: ["Balita", "Lansia"], inverse: true }, { type: "category", gridIndex: 1, data: ["Balita", "Lansia"], axisLabel: { show: false }, inverse: true }],
    series: [
      { type: "bar", xAxisIndex: 0, yAxisIndex: 0, data: [(age.rr_balita - 1) * 100, (age.rr_lansia - 1) * 100], itemStyle: { color: C.focus }, label: { show: true, position: "right", formatter: (p: any) => fmtPct(p.value, 0, true), fontWeight: 700 } },
      { type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: [age.total_kasus["ISPA balita"], age.total_kasus["ISPA lansia"]], itemStyle: { color: C.other }, label: { show: true, position: "right", formatter: (p: any) => `${fmt(p.value / 1000, 0)} rb`, fontWeight: 700 } },
    ],
  };

  const ecoV = eco.data.filter((r) => eco.dipakai.includes(r.hospital_id));

  const tsOpt: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "line" }, valueFormatter: (v: any) => (v == null ? "–" : fmt(v, 2)) },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    legend: { top: 0, data: wk.rows.map((r) => byCode[r.c].nama) },
    grid: [{ left: 8, right: 16, top: 34, height: "38%" }, { left: 8, right: 16, top: "58%", bottom: 40 }],
    xAxis: [
      { type: "category", data: wk.weeks.map(fmtDate), gridIndex: 0, axisLabel: { show: false }, axisTick: { show: false } },
      { type: "category", data: wk.weeks.map(fmtDate), gridIndex: 1, axisLabel: { fontSize: 10.5 } },
    ],
    yAxis: [
      { type: "log", min: 5, gridIndex: 0, name: `PM2.5 (${UG}) · skala log`, nameTextStyle: { align: "left" } },
      { type: "value", gridIndex: 1, name: `${tsOut} · 1 = minggu biasa`, nameTextStyle: { align: "left" }, min: (v: any) => Math.max(0, Math.floor(v.min * 5) / 5) },
    ],
    dataZoom: [{ type: "inside", xAxisIndex: [0, 1] }],
    series: [
      ...wk.rows.map((r) => ({ name: byCode[r.c].nama, type: "line" as const, xAxisIndex: 0, yAxisIndex: 0, symbol: "none", data: r.pm, lineStyle: { width: 2 }, itemStyle: { color: PICK_COL[r.slot] },
        markLine: r.slot === wk.rows[0].slot ? { silent: true, symbol: "none", lineStyle: { color: C.ink, type: "dashed" as const }, label: { formatter: "150 · ambang", position: "insideEndTop" as const, color: C.ink, fontSize: 10.5 }, data: [{ yAxis: 150 }] } : undefined })),
      ...wk.rows.map((r) => ({ name: byCode[r.c].nama, type: "line" as const, xAxisIndex: 1, yAxisIndex: 1, symbol: "none", data: r.y, lineStyle: { width: 2 }, itemStyle: { color: PICK_COL[r.slot] } })),
    ],
  };
  const rB = rr.gabungan["ISPA balita"], rK = rr.gabungan["Kematian"];

  return (
    <Page path="/dampak"
      kpis={<>
        <Kpi k="ISPA balita, tiap PM2.5 berlipat dua" v={fmtPct((rB.rr - 1) * 100, 0, true)} note={`CI 95% ${fmtPct((rB.lo - 1) * 100, 0, true)} s.d. ${fmtPct((rB.hi - 1) * 100, 0, true)}`} />
        <Kpi k="Kematian, tiap PM2.5 berlipat dua" v={fmtPct((rK.rr - 1) * 100, 0, true)} note={`CI 95% ${fmtPct((rK.lo - 1) * 100, 0, true)} s.d. ${fmtPct((rK.hi - 1) * 100, 0, true)}`} />
        <Kpi k="Kematian pada hari Berbahaya" v={`${fmt(dose.gabungan["Kematian"][4], 1)}×`} note={`hari biasa · PM2.5 > 250 ${UG}`} />
        <Kpi k="Jeda paparan → kasus" v="Hari yang sama" note="jeda 1–3 hari & plasebo tidak bermakna" />
      </>}
      main={
        <Card title="PM2.5 dan kasus rumah sakit per minggu" sub="Atas: PM2.5 stasiun. Bawah: kasus di RS pasangannya, dibagi rata-rata RS itu (1 = minggu biasa). Ganti stasiun di bar atas; gulir di grafik untuk memperbesar."
          right={<select value={tsOut} onChange={(e) => setTsOut(e.target.value)} aria-label="Pilih jenis kasus" className="pick-select">{OUT.map((o) => <option key={o}>{o}</option>)}</select>}>
          {wk.rows.length ? <Chart option={tsOpt} height={440} ariaLabel="PM2.5 dan kasus rumah sakit mingguan" />
            : <p className="note">Stasiun pilihan belum punya RS pasangan dengan data PM2.5 yang layak. Pilih stasiun lain di bar atas, misalnya {PICK_GLYPH[0]} Palangka Raya.</p>}
        </Card>
      }
      method="Model dua tahap: quasi-Poisson per RS (log₂ PM2.5 hari yang sama + spline waktu 12 df + suhu + hari), digabung meta-analisis random effects. Stabil di 8 uji sensitivitas. Data sintetis: dibaca sebagai asosiasi, bukan bukti sebab-akibat."
      supports={[
        <Card key="d" title="Kasus relatif menurut kategori ISPU" sub="1 = hari biasa di RS itu. Simbol berwarna = RS pasangan stasiun pilihan."
          right={<select value={out} onChange={(e) => setOut(e.target.value)} aria-label="Pilih penyakit" className="pick-select">{OUT.map((o) => <option key={o}>{o}</option>)}</select>}>
          <Chart option={doseOpt} height={300} ariaLabel="Dosis-respons per kategori ISPU" />
        </Card>,
        <Card key="a" title="Kenaikan risiko tiap PM2.5 berlipat dua" sub="Batang = perkiraan, garis = CI 95%">
          <div style={{ display: "grid", gap: 7, marginTop: 6 }}>
            {OUT.map((o) => {
              const r = rr.gabungan[o];
              const max = 80;
              return (
                <div key={o} style={{ display: "grid", gridTemplateColumns: "118px 1fr 52px", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <span>{o}</span>
                  <span style={{ position: "relative", height: 14, background: "var(--surface-2)", borderRadius: 4 }}>
                    <span style={{ position: "absolute", left: `${((r.lo - 1) * 100 / max) * 100}%`, width: `${((r.hi - r.lo) * 100 / max) * 100}%`, top: 6, height: 2, background: C.ink }} />
                    <span style={{ position: "absolute", left: 0, width: `${((r.rr - 1) * 100 / max) * 100}%`, top: 2, height: 10, background: C.focus, borderRadius: 3 }} />
                  </span>
                  <b style={{ textAlign: "right" }}>{fmtPct((r.rr - 1) * 100, 0, true)}</b>
                </div>
              );
            })}
          </div>
          <p className="note">I² = keragaman efek antar RS. Garis hitam = rentang CI 95%.</p>
        </Card>,
        <Card key="b" title="Efek menurut jeda hari" sub="Abu = plasebo (PM2.5 sesudah kasus)"
          right={<Seg value={lagMode} onChange={setLagMode} options={[["gabung", "Model gabungan"], ["satu", "Satu lag"]]} />}
          note={lagMode === "satu" ? "Model satu lag: plasebo pun tampak 'berefek' → hanya autokorelasi asap." : "Semua jeda dimasukkan bersamaan: hanya hari yang sama yang bermakna."}>
          <div className="tabs" style={{ marginBottom: 4 }}>{["ISPA balita", "Rawat napas umum", "Kematian"].map((o) => <button key={o} aria-pressed={lagOut === o} onClick={() => setLagOut(o)}>{o}</button>)}</div>
          <Chart option={lagOpt} height={210} />
        </Card>,
        <Card key="c" title="Balita dan lansia" sub={`RR ${fmt(age.rr_balita, 2)} vs ${fmt(age.rr_lansia, 2)} (p = ${fmt(age.p_beda, 2)})`}>
          <Chart option={ageOpt} height={200} />
        </Card>,
      ]}
      extra={
        <details className="more">
          <summary>Beban kronis antar RS (analisis ekologis, ρ = {fmt(eco.rho, 2)})</summary>
          <div className="card" style={{ marginTop: 8 }}>
            <Chart height={320} option={{
              tooltip: { formatter: (p: any) => `<b>${byCode[p.data.code]?.nama}</b><br/>PM2.5 ${fmt(p.value[0])} ${UG}<br/>${fmt(p.value[1], 2)} kasus napas/hari per 100 TT` },
              grid: { left: 8, right: 14, top: 14, bottom: 30 },
              xAxis: { type: "value", name: `Rata-rata PM2.5 (${UG})`, nameLocation: "middle", nameGap: 24 }, yAxis: { type: "value", name: "kasus napas / 100 TT / hari" },
              series: [{ type: "scatter", symbolSize: 11, itemStyle: { color: C.focus }, label: { show: true, formatter: (p: any) => byCode[p.data.code]?.nama, position: "right", fontSize: 10 },
                data: ecoV.map((r) => ({ value: [r.pm25, r.resp_per100], code: r.code })) }],
            }} />
            <p className="note">RS Tipe A & RS-24–27 dikeluarkan. Ini perbandingan antar wilayah, bukan efek harian.</p>
          </div>
        </details>
      }
    />
  );
}
