import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import Chart from "../components/Chart";
import { Card, Kpi, Page, Seg, Story } from "../components/Layout";
import { BarsViz, DotsViz, ParticleBox, Reveal, SlopeViz, VersusViz } from "../components/Viz";
import { useData } from "../lib/data";
import { fmt, fmtPct, UG } from "../lib/format";
import { useApp, usePick, usePickSymbol, useStationFilter } from "../lib/state";
import { C, GAMBUT_COL, MUTED, TIPE_COL } from "../lib/theme";
import type { Summary } from "../lib/types";

type Annual = { per_stasiun: { code: string; tahun: number; rata2: number; lengkap: boolean; lampaui_PP22: boolean }[]; tangga_who: Record<string, Record<string, number>>; urutan_tangga: string[] };
type Trend = { kelompok: Record<string, Record<string, number>>; kelompok_musim: { gambut: string; musim: string; [y: string]: number | string }[] };
type Iku = { data: { code: string; tahun: number; IKU: number; kategori_IKU: string; pm25: number }[]; buta_asap_2025: string[]; rho_2025: number };

const PULAU_URUT = ["Kalimantan", "Sumatera", "Jawa", "Sulawesi", "Papua"];
/** Stasiun yang paling bercerita untuk pembanding partikel: terpekat, gambut, kota, terbersih. */
const CONTOH = ["SM2-01", "KTG-01", "JKT-02", "IDP-01"];

export default function Q1Kondisi() {
  const d = useData<[Summary[], Annual, Trend, Iku]>("station_summary", "annual", "trend", "iku");
  const { acuan, byCode, openProfil } = useApp();
  const pick = usePick();
  const sym = usePickSymbol();
  const filt = useStationFilter();
  const [musim, setMusim] = useState<"semua" | "Jan–Jun" | "Jul–14 Okt">("semua");
  const [view, setView] = useState<"pulau" | "rank">("pulau");
  const [air, setAir] = useState("SM2-01");

  const quad = useMemo<EChartsOption | null>(() => {
    if (!d) return null;
    const ref = acuan === "who" ? 35 : 15;
    const tipes = Object.keys(TIPE_COL);
    return {
      tooltip: { formatter: (p: any) => p.data?.s ? `<b>${byCode[p.data.s.code].nama}</b> (${p.data.s.code})<br/>${p.data.s.tipe}<br/>Rata-rata: <b>${fmt(p.value[0])}</b> ${UG}<br/>Persentil 95: <b>${fmt(p.value[1])}</b> ${UG}` : "" },
      legend: { bottom: 0, data: tipes, itemGap: 10, textStyle: { fontSize: 11 } },
      grid: { left: 10, right: 30, top: 20, bottom: 74 },
      xAxis: { type: "log", name: `Rata-rata PM2.5 harian (${UG}) → beban kronis`, nameLocation: "middle", nameGap: 28, min: 5, max: 200 },
      yAxis: { type: "log", name: "Persentil 95 → keparahan episode", nameLocation: "middle", nameGap: 40, min: 10, max: 1000 },
      series: tipes.map((t) => ({
        name: t, type: "scatter", itemStyle: { color: TIPE_COL[t] },
        data: d[0].filter((s) => s.tipe === t).map((s) => {
          const ring = pick(s.code), on = filt(s.code);
          return {
            value: [s.rata2_pm25, s.p95_pm25], s, symbolSize: ring ? 18 : 12, symbol: sym(s.code) ?? "circle",
            itemStyle: { color: on ? TIPE_COL[t] : MUTED, borderColor: ring ?? "#fff", borderWidth: ring ? 3 : 1, opacity: on ? 1 : 0.4 },
            label: { show: !!ring || s.code === "SM2-01", formatter: byCode[s.code].nama, position: "right", fontSize: 12, fontWeight: 700, color: C.ink, textBorderColor: "#fff", textBorderWidth: 3 },
          };
        }),
        markLine: t === tipes[0] ? {
          silent: true, symbol: "none", lineStyle: { color: C.inkSoft, type: "dashed" },
          label: { formatter: acuan === "who" ? "WHO IT-1 = 35" : "Baku mutu tahunan = 15", position: "end", color: C.inkSoft, fontSize: 11 },
          data: [{ xAxis: ref }],
        } : undefined,
      })),
    };
  }, [d, acuan, pick, filt, byCode, sym]);

  if (!d || !quad) return <div className="loading">Memuat data kualitas udara…</div>;
  const [summ, ann, trend, iku] = d;
  const sById = Object.fromEntries(summ.map((s) => [s.code, s]));

  const groups = ["Gambut", "Non-gambut"];
  const trendOpt: EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (v: any) => `${fmt(v)} ${UG}` },
    legend: { bottom: 0, data: ["Kawasan gambut", "Kawasan lain"] }, grid: { left: 8, right: 70, top: 26, bottom: 34 },
    xAxis: { type: "category", data: ["2024", "2025", "2026"], axisLabel: { fontSize: 12, fontWeight: 600 } }, yAxis: { type: "value", name: UG },
    series: groups.map((g) => {
      const vals = musim === "semua" ? ["2024", "2025", "2026"].map((y) => trend.kelompok[g][y])
        : ["2024", "2025", "2026"].map((y) => trend.kelompok_musim.find((r) => r.gambut === g && r.musim === musim)![y] as number);
      const ch = (vals[2] / vals[0] - 1) * 100;
      const main = g === "Gambut";
      return {
        name: main ? "Kawasan gambut" : "Kawasan lain", type: "line", data: vals, symbolSize: main ? 12 : 9, smooth: 0.25,
        lineStyle: { width: main ? 4 : 2.5 }, itemStyle: { color: GAMBUT_COL[g as "Gambut"] },
        areaStyle: main ? { opacity: 0.12 } : undefined,
        label: { show: true, position: "top", formatter: (p: any) => fmt(p.value, 0), fontSize: 12, fontWeight: 700, color: C.ink },
        endLabel: { show: true, formatter: fmtPct(ch, 0, true), fontWeight: 800, fontSize: 14, color: main ? C.gambut : C.inkSoft, offset: [8, 0] },
        animationDuration: 1400,
      };
    }),
  };

  const iku25 = iku.data.filter((r) => r.tahun === 2025);
  const ikuOpt: EChartsOption = {
    tooltip: { formatter: (p: any) => `<b>${byCode[p.data.code].nama}</b><br/>IKU ${fmt(p.value[0])} (${p.data.kat})<br/>PM2.5 ${fmt(p.value[1])} ${UG}` },
    grid: { left: 8, right: 14, top: 14, bottom: 30 },
    xAxis: { type: "value", name: "Nilai IKU 2025 (dari NO₂ & SO₂) →  makin baik", nameLocation: "middle", nameGap: 24, min: 0, max: 100 },
    yAxis: { type: "value", name: `PM2.5 2025 (${UG})` },
    series: [{
      type: "scatter", symbolSize: 13,
      data: iku25.map((r) => {
        const blind = iku.buta_asap_2025.includes(r.code);
        return { value: [r.IKU, r.pm25], code: r.code, kat: r.kategori_IKU, symbol: sym(r.code) ?? "circle",
          itemStyle: { color: !filt(r.code) ? MUTED : blind ? C.alert : C.other, borderColor: pick(r.code) ?? "#fff", borderWidth: pick(r.code) ? 3 : 1.5 },
          label: { show: blind && r.pm25 > 60, formatter: byCode[r.code].nama, position: "left", fontSize: 11, fontWeight: 700, color: C.ink, textBorderColor: "#fff", textBorderWidth: 3 } };
      }),
      markLine: { silent: true, symbol: "none", lineStyle: { type: "dashed", color: C.inkSoft }, label: { formatter: "35 (WHO IT-1)", position: "insideStartTop" }, data: [{ yAxis: 35 }] },
      markArea: { silent: true, itemStyle: { color: "rgba(180,35,24,0.06)" }, label: { show: true, formatter: 'IKU "Baik", tetapi PM2.5 > 35', position: "insideTopLeft", color: C.alert, fontWeight: 700, fontSize: 11.5 }, data: [[{ xAxis: 70, yAxis: 35 }, { xAxis: 100, yAxis: 400 }]] },
    }],
  };

  // Rata-rata tahunan 2025 per stasiun (hanya tahun yang lengkap ≥75% hari).
  const rank = ann.per_stasiun.filter((r) => r.tahun === 2025 && r.lengkap).sort((a, b) => a.rata2 - b.rata2);
  const refLine = acuan === "who" ? 35 : 15;
  const refLab = acuan === "who" ? "WHO IT-1 · 35" : "Baku mutu tahunan · 15";
  const rankOpt: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: any) => { const r = rank[ps[0].dataIndex]; return `<b>${byCode[r.code].nama}</b> · ${byCode[r.code].kelompok}<br/>Rata-rata 2025: <b>${fmt(r.rata2)}</b> ${UG}`; } },
    grid: { left: 8, right: 70, top: 26, bottom: 24 },
    xAxis: { type: "value", name: UG, nameLocation: "end" },
    yAxis: { type: "category", data: rank.map((r) => byCode[r.code].nama), axisLabel: { fontSize: 11.5, color: C.ink }, axisTick: { show: false } },
    series: [{
      type: "bar", barWidth: 12,
      data: rank.map((r) => {
        const on = filt(r.code), ring = pick(r.code);
        return { value: r.rata2, code: r.code, itemStyle: { color: !on ? MUTED : byCode[r.code].gambut ? C.gambut : C.other, borderRadius: [0, 4, 4, 0], borderColor: ring ?? undefined, borderWidth: ring ? 2 : 0 } };
      }),
      label: { show: true, position: "right", formatter: (p: any) => fmt(p.value), fontSize: 11, color: C.inkSoft },
      markLine: { silent: true, symbol: "none", lineStyle: { color: C.ink, type: "dashed", width: 1.5 }, label: { formatter: refLab, position: "end", color: C.ink, fontSize: 11, fontWeight: 600 }, data: [{ xAxis: refLine }] },
    }],
  };

  // Titik per pulau: satu baris per pulau, titik digeser naik-turun sedikit supaya tidak menumpuk.
  const rows = PULAU_URUT.filter((p) => rank.some((r) => byCode[r.code].pulau === p));
  const stripData = rows.flatMap((p, yi) => rank.filter((r) => byCode[r.code].pulau === p).map((r, k) => ({ r, y: yi + (k % 3 === 0 ? 0 : k % 3 === 1 ? 0.22 : -0.22) })));
  const extremes = new Set(rows.map((p) => rank.filter((r) => byCode[r.code].pulau === p).slice(-1)[0]?.code));
  const pulauMean = rows.map((p) => { const v = rank.filter((r) => byCode[r.code].pulau === p).map((r) => r.rata2); return v.reduce((a, b) => a + b, 0) / v.length; });
  const stripOpt: EChartsOption = {
    tooltip: { formatter: (p: any) => p.data?.code ? `<b>${byCode[p.data.code].nama}</b> · ${byCode[p.data.code].provinsi}<br/>${byCode[p.data.code].kelompok}<br/>Rata-rata 2025: <b>${fmt(p.value[0])}</b> ${UG}<br/><span style="color:#6b7a82">Klik untuk profil stasiun</span>` : `${p.name}` },
    grid: { left: 8, right: 30, top: 34, bottom: 34 },
    xAxis: { type: "value", min: 0, max: (v: any) => Math.ceil((v.max + 5) / 10) * 10, name: `Rata-rata PM2.5 2025 (${UG}) → makin pekat`, nameLocation: "middle", nameGap: 26 },
    yAxis: { type: "value", min: -1, max: rows.length, interval: 1, inverse: true, splitLine: { show: true, lineStyle: { color: "#edf2f3" } },
      axisLabel: { formatter: (v: number) => rows[Math.round(v)] ?? "", fontSize: 13, fontWeight: 700, color: C.ink }, axisTick: { show: false }, axisLine: { show: false } },
    series: [
      { type: "scatter", name: "Stasiun", animationDelay: (i: number) => i * 45, animationDuration: 700,
        data: stripData.map(({ r, y }) => {
          const on = filt(r.code), ring = pick(r.code), g = byCode[r.code].gambut;
          return { value: [r.rata2, y], code: r.code, symbol: sym(r.code) ?? "circle", symbolSize: ring ? 20 : 15,
            itemStyle: { color: !on ? MUTED : g ? C.gambut : C.focus, borderColor: ring ?? "#fff", borderWidth: ring ? 3 : 2, shadowBlur: 6, shadowColor: "rgba(0,0,0,.12)" },
            label: { show: extremes.has(r.code) || !!ring, formatter: byCode[r.code].nama, position: "top", distance: 6, fontSize: 11.5, fontWeight: 700, color: C.ink, textBorderColor: "#fff", textBorderWidth: 3 } };
        }),
        markLine: { silent: true, symbol: "none", animation: false,
          data: [
            { xAxis: refLine, lineStyle: { color: C.alert, type: "dashed", width: 1.6 }, label: { formatter: refLab, position: "start", color: C.alert, fontWeight: 700, fontSize: 11 } },
          ] },
        markArea: { silent: true, itemStyle: { color: "rgba(180,35,24,0.045)" }, data: [[{ xAxis: refLine }, { xAxis: "max" }]] },
      },
      { type: "scatter", name: "Rata-rata pulau", symbol: "rect", symbolSize: [3, 26], silent: true, z: 1,
        data: rows.map((_, yi) => [pulauMean[yi], yi]), itemStyle: { color: C.ink, opacity: 0.55 },
        label: { show: true, position: "bottom", distance: 4, formatter: (p: any) => `rata-rata ${fmt(p.value[0], 0)}`, fontSize: 10.5, color: C.inkSoft } },
    ],
  };

  const above = rank.filter((r) => r.rata2 > refLine).length;
  const blindN = iku.buta_asap_2025.length;
  const tg = trend.kelompok;
  const pct = (g: string) => (tg[g]["2026"] / tg[g]["2024"] - 1) * 100;
  const lampaui = ann.per_stasiun.filter((r) => r.tahun === 2025 && r.lengkap && r.lampaui_PP22).length;
  const w24 = ann.tangga_who["2024"][ann.urutan_tangga[0]], w25 = ann.tangga_who["2025"][ann.urutan_tangga[0]];
  const a = sById[air];
  const top = rank[rank.length - 1];

  return (
    <Page path="/kondisi"
      headline={`${fmt(lampaui, 0)} dari ${rank.length} Stasiun Mencatat Udara di Atas Baku Mutu`}
      kpis={<>
        <Kpi k="Stasiun di Atas Baku Mutu Tahunan" v={`${fmt(lampaui, 0)} dari ${rank.length}`}
          viz={<DotsViz n={lampaui} total={rank.length} tone="alert" cols={12} />} note={`Rata-rata 2025 di atas 15 ${UG}. Hanya ${rank.length - lampaui} stasiun yang lolos.`} />
        <Kpi k="Gagal Target WHO Paling Longgar (35)" v={`${w24} → ${w25}`} unit="stasiun"
          viz={<BarsViz values={[w24, w25]} labels={["2024", "2025"]} tone="alert" />} note={`Bertambah ${w25 - w24} stasiun dalam setahun.`} />
        <Kpi k="Perubahan PM2.5 Kawasan Gambut" v={fmtPct(pct("Gambut"), 0, true)}
          viz={<SlopeViz a={[tg.Gambut["2024"], tg.Gambut["2026"]]} b={[tg["Non-gambut"]["2024"], tg["Non-gambut"]["2026"]]} la="Gambut" lb="Lain" from="2024" to="2026" />}
          note={`1 Jan–14 Okt tiap tahun. Kawasan lain hanya ${fmtPct(pct("Non-gambut"), 0, true)}.`} />
        <Kpi k={'IKU "Baik", padahal PM2.5 di Atas 35'} v={fmt(blindN, 0)} unit="stasiun"
          viz={<VersusViz left={{ k: "Kata IKU", v: "Baik" }} right={{ k: "Kata PM2.5", v: "Tidak sehat" }} />} note="IKU hanya dihitung dari NO₂ dan SO₂, jadi asap tidak terbaca." />
      </>}
      main={
        <Card title="Rata-rata PM2.5 Tiap Stasiun, 2025"
          sub={view === "pulau"
            ? `Setiap titik satu stasiun, dikelompokkan per pulau. Oranye = kawasan gambut. ${above} dari ${rank.length} titik berada di area merah (di atas ${acuan === "who" ? "WHO IT-1" : "baku mutu"}). Klik titik untuk profil.`
            : `Diurutkan dari yang paling bersih. Oranye = kawasan gambut. Klik batang untuk profil.`}
          right={<Seg value={view} onChange={setView} options={[["pulau", "Per Pulau"], ["rank", "Peringkat Lengkap"]]} />}>
          {view === "pulau"
            ? <Chart option={stripOpt} height={rows.length * 70 + 150} onClick={(p: any) => p.data?.code && openProfil(p.data.code)} ariaLabel="Rata-rata PM2.5 per stasiun dikelompokkan per pulau" />
            : <Chart option={rankOpt} height={Math.max(420, rank.length * 22)} onClick={(p: any) => p.data?.code && openProfil(p.data.code)} ariaLabel="Peringkat rata-rata PM2.5 per stasiun" />}
        </Card>
      }
      method="Rata-rata tahunan hanya sah bila ≥75% hari punya data. Tren memakai periode 1 Jan–14 Okt tiap tahun (BJB-01 & MER-01 dikeluarkan karena cakupan <75%). IKU dihitung ulang dari NO₂ & SO₂ sesuai Permen LHK 27/2021. Kotak partikel: satu titik = 1 µg PM2.5 dalam satu meter kubik udara."
      stories={<>
        <Reveal as="section" className="story-row air-row">
          <div className="story-text">
            <h2>Isi Satu Meter Kubik Udara</h2>
            <p className="story-bignote">Satu titik = 1 µg PM2.5. Bandingkan batas aman WHO dengan udara sehari-hari di stasiun pilihan.</p>
            <div className="air-pick" role="group" aria-label="Pilih stasiun pembanding">
              {CONTOH.filter((c) => sById[c]).map((c) => <button key={c} aria-pressed={air === c} onClick={() => setAir(c)}>{byCode[c].nama}</button>)}
              <select className="pick-select" value={CONTOH.includes(air) ? "" : air} onChange={(e) => e.target.value && setAir(e.target.value)} aria-label="Stasiun lain">
                <option value="">Stasiun lain…</option>
                {[...summ].sort((x, y) => byCode[x.code].nama.localeCompare(byCode[y.code].nama)).map((s) => <option key={s.code} value={s.code}>{byCode[s.code].nama}</option>)}
              </select>
            </div>
            <div className="story-body"><p>{a ? <>Pada hari biasa, PM2.5 di <b>{byCode[air].nama}</b> sudah {fmt(a.rata2_pm25 / 15, 1)} kali batas WHO. Pada 5% hari terburuknya, {fmt(a.p95_pm25 / 15, 0)} kali.</> : null}</p></div>
          </div>
          <div className="air-compare">
            <ParticleBox value={15} title="Batas Harian WHO" sub="Pedoman 2021" />
            <ParticleBox value={a?.rata2_pm25 ?? null} title={`Hari Biasa di ${byCode[air]?.nama ?? "–"}`} sub="Rata-rata 2024–2026" />
            <ParticleBox value={a?.p95_pm25 ?? null} title={`Hari Terburuk di ${byCode[air]?.nama ?? "–"}`} sub="Persentil 95" />
          </div>
        </Reveal>
        <Story tone="gambut" title="Gambut Naik, Kawasan Lain Datar"
          big={fmtPct(pct("Gambut"), 0, true)} bigNote="PM2.5 kawasan gambut, 2024 → 2026"
          right={<Seg value={musim} onChange={setMusim} options={[["semua", "Setahun"], ["Jan–Jun", "Luar Musim"], ["Jul–14 Okt", "Musim Asap"]]} />}
          chart={<Chart option={trendOpt} height={320} ariaLabel="Tren PM2.5 gambut dan kawasan lain" />}>
          <p>Di luar musim asap, kedua kelompok hampir sama. Bedanya muncul <b>Juli sampai Oktober</b>: pilih "Musim Asap" untuk melihat garis gambut melonjak.</p>
        </Story>
        <Story flip tone="alert" title={'IKU Bilang "Baik", PM2.5 Bilang Tidak'}
          big={fmt(blindN, 0)} bigNote={`stasiun ber-IKU "Baik" dengan PM2.5 tahunan > 35 ${UG}`}
          chart={<Chart option={ikuOpt} height={320} onClick={(p: any) => p.data?.code && openProfil(p.data.code)} ariaLabel="IKU versus PM2.5 per stasiun" />}>
          <p>Indeks Kualitas Udara resmi hanya memakai NO₂ dan SO₂. Akibatnya stasiun yang paling berasap, seperti {top ? <b>{byCode[top.code].nama}</b> : null}, tetap tercatat "Baik". Titik merah adalah stasiun yang terlewat.</p>
        </Story>
      </>}
      more={[
        <Card key="q" title="Rata-rata dan Lonjakan" sub="Skala log. Oranye = episodik (asap musiman), slate = kronis.">
          <Chart option={quad} height={360} onClick={(p: any) => p.data?.s && openProfil(p.data.s.code)} ariaLabel="Rata-rata vs persentil 95" />
        </Card>,
        <Card key="t" title="Perubahan per Stasiun" sub="1 Jan–14 Okt, 2024 → 2026">
          <Chart height={420} option={{
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: any) => fmtPct(v, 1, true) },
            grid: { left: 8, right: 30, top: 10, bottom: 20 },
            xAxis: { type: "value", name: "%" },
            yAxis: { type: "category", axisLabel: { fontSize: 10.5 }, data: [...summ].filter((s) => s["ubah_%"] != null && !byCode[s.code].excl_tren).sort((x, y) => x["ubah_%"]! - y["ubah_%"]!).map((s) => byCode[s.code].nama) },
            series: [{ type: "bar", barWidth: 10, data: [...summ].filter((s) => s["ubah_%"] != null && !byCode[s.code].excl_tren).sort((x, y) => x["ubah_%"]! - y["ubah_%"]!).map((s) => ({ value: s["ubah_%"], itemStyle: { color: byCode[s.code].gambut ? GAMBUT_COL.Gambut : GAMBUT_COL["Non-gambut"], borderRadius: 3 } })) }],
          }} />
        </Card>,
      ]}
    />
  );
}
