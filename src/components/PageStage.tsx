import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MapViewState } from "@deck.gl/core";
import Stage3D, { type VIEWS } from "./Stage3D";
import { useData } from "../lib/data";
import { useApp, useStationFilter } from "../lib/state";
import { fmt, fmtPct, UG } from "../lib/format";
import type { Summary } from "../lib/types";

type Score = { code: string; grade: string; kategori: string; baris_sensor_beku: number };
type Annual = { per_stasiun: { code: string; tahun: number; rata2: number; lengkap: boolean; lampaui_PP22: boolean }[] };
type Iku = { buta_asap_2025: string[] };
type Pairs = { pasangan_r099: { jarak_km: number; "beda_level_%": number }[] };
/** Bagian angka_kunci.json yang dipakai panggung. */
type AK = {
  tren_1jan_14okt: Record<string, { "2024": number; "2026": number }>;
  puncak_bulanan_gambut: Record<string, number>;
  minggu_awal_risiko_gambut: Record<string, number>;
  "dekomposisi_variasi_%": Record<string, number>;
  "shap_pemicu_%": Record<string, number>;
  korelasi_lalu_lintas_pm25_JanJun: number;
  rr_per_lipat_dua: Record<string, { rr: number }>;
  ambang: Record<string, number>;
  jaringan: Record<string, number>;
};
type Year = "2024" | "2025" | "2026";
type View = keyof typeof VIEWS | MapViewState;

/** Satu langkah cerita: judul pendek, 1–2 kalimat, dan apa yang diubah di panggung 3D. */
type Step = { t: string; d: ReactNode; view?: View; values?: Record<string, number | null>; visible?: (c: string) => boolean; labels?: string[]; years?: boolean };

const at = (s: { lon: number; lat: number } | undefined, zoom = 5.6, bearing = -18): View =>
  s ? { longitude: s.lon, latitude: s.lat - 1.1, zoom, pitch: 58, bearing } : "nasional";

/**
 * Panggung 3D + langkah cerita di atas tiap halaman topik. Semua angka dibaca dari JSON yang sama
 * dengan kartu angka di halaman, supaya tidak ada dua angka berbeda untuk hal yang sama.
 */
export default function PageStage({ path, cap = null }: { path: string; cap?: number | null }) {
  const d = useData<[Summary[], Score[], Annual, AK, Iku, Pairs]>("station_summary", "scorecard", "annual", "angka_kunci", "iku", "pairs");
  const { pilihan, byCode } = useApp();
  const filt = useStationFilter();
  const [year, setYear] = useState<Year>("2026");
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [path]);

  const sc = useMemo(() => Object.fromEntries((d?.[1] ?? []).map((s) => [s.code, s])), [d]);
  const andal = useCallback((c: string) => filt(c) && sc[c]?.kategori === "Andal", [filt, sc]);
  const steps = useMemo<Step[]>(() => {
    if (!d) return [];
    const [summ, , ann, ak, iku, pairs] = d;
    const per = (y: Year) => Object.fromEntries(summ.map((s) => [s.code, (s as unknown as Record<string, number | null>)[`periode_${y}`] ?? null]));
    const mean = Object.fromEntries(summ.map((s) => [s.code, s.rata2_pm25]));
    const a25 = ann.per_stasiun.filter((r) => r.tahun === 2025 && r.lengkap);
    const v25 = Object.fromEntries(a25.map((r) => [r.code, r.rata2]));
    const first = byCode[pilihan[0]];
    switch (path) {
      case "/kondisi": {
        const pulau: Record<string, number[]> = {};
        summ.forEach((s) => (pulau[s.pulau] ??= []).push(s.rata2_pm25));
        const rank = Object.entries(pulau).map(([p, v]) => [p, v.reduce((a, b) => a + b, 0) / v.length] as const).sort((a, b) => b[1] - a[1]);
        const blind = new Set(iku.buta_asap_2025);
        // dihitung dari rata-rata (bukan kolom ubah_% yang dibulatkan) supaya sama dengan kartu: +102%
        const ch = (g: string) => (ak.tren_1jan_14okt[g]["2026"] / ak.tren_1jan_14okt[g]["2024"] - 1) * 100;
        return [
          { t: "Hampir semua di atas batas", view: "nasional", values: v25,
            d: <><b>{a25.filter((r) => r.lampaui_PP22).length} dari {a25.length}</b> stasiun punya rata-rata 2025 di atas baku mutu tahunan 15 {UG}.</> },
          { t: "Kalimantan paling pekat", view: "kalimantan", values: mean,
            d: <>Rata-rata per pulau: {rank.map(([p, v], k) => <span key={p}>{k ? " · " : ""}{p} <b>{fmt(v)}</b></span>)} {UG}.</> },
          { t: "Gambut memburuk, kota datar", view: "barat", values: per("2026"),
            d: <>1 Jan–14 Okt, 2024 → 2026: kawasan gambut <b>{fmtPct(ch("Gambut"), 0, true)}</b>, kawasan lain hanya {fmtPct(ch("Non-gambut"), 0, true)}.</> },
          { t: "IKU bilang \"Baik\"", view: "nasional", values: v25, visible: (c) => blind.has(c),
            d: <><b>{blind.size} stasiun</b> ber-IKU "Baik" padahal PM2.5 &gt; 35 {UG}, karena IKU hanya menghitung NO₂ dan SO₂.</> },
        ];
      }
      case "/waktu": {
        const pk = ak.puncak_bulanan_gambut, mg = ak.minggu_awal_risiko_gambut;
        return [
          { t: "Tiap tahun makin pekat", view: "barat", values: per(year), years: true,
            d: <>Puncak bulanan kawasan gambut: <b>{fmt(pk["2024"], 0)} → {fmt(pk["2025"], 0)} → {fmt(pk["2026"], 0)}</b> {UG}. Ganti tahun di pojok kiri.</> },
          { t: "Mulai akhir Juli", view: "kalimantan", values: per("2026"),
            d: <>Musim risiko gambut dimulai <b>minggu ke-{mg["2026"]}</b> (2024 dan 2025: minggu ke-{mg["2024"]}), puncaknya September–Oktober.</> },
          { t: "Kota punya jam sibuk", view: "jawa", values: mean,
            d: <>Stasiun tepi jalan memuncak <b>07–09 dan 17–19</b>. Asap gambut tidak kenal jam: datar sepanjang hari.</> },
          // shortcut: 0,03% disalin dari catatan metode Pola Waktu; pindah ke angka_kunci bila pipeline diulang
          { t: "Akhir pekan tidak lebih bersih", view: "jawa", values: mean,
            d: <>Selisih hari kerja dan akhir pekan hanya <b>0,03%</b> (median stasiun). Sumber utamanya bukan aktivitas kantor.</> },
        ];
      }
      case "/pemicu": {
        const dv = ak["dekomposisi_variasi_%"], sh = ak["shap_pemicu_%"];
        const cuaca = sh["Suhu"] + sh["Kelembapan"] + sh["Angin (kecepatan & arah)"];
        return [
          { t: `Musim: ${fmt(dv["Musim/episode (stasiun-bulan)"], 0)}%`, view: "barat", values: per("2026"),
            d: <>Naik-turun PM2.5 paling banyak ditentukan <b>musim dan episode asap</b>, bukan lokasi.</> },
          { t: `Lokasi: ${fmt(dv["Lokasi (antar stasiun)"], 0)}%`, view: "nasional", values: mean,
            d: <>Beda antarstasiun menjelaskan sisanya. Pada skala log porsinya naik ke <b>59%</b>: kota memang selalu lebih kotor.</> },
          { t: "Kota: lalu lintas", view: "jawa", values: mean,
            d: <>Di luar musim asap (Jan–Jun), lalu lintas dan PM2.5 searah: <b>ρ = {fmt(ak.korelasi_lalu_lintas_pm25_JanJun, 2)}</b>.</> },
          { t: `Cuaca: ${fmt(cuaca, 0)}%`, view: "rendah", values: mean,
            d: <>Suhu, kelembapan, dan angin hanya menggeser <b>{fmt(cuaca, 0)}%</b>. Arah angin hampir tidak membedakan PM2.5.</> },
        ];
      }
      case "/dampak": {
        const rr = ak.rr_per_lipat_dua;
        const p = (k: string) => fmtPct((rr[k].rr - 1) * 100, 0, true);
        return [
          { t: "PM2.5 berlipat dua", view: at(first), values: mean,
            d: <>Kasus ISPA balita di RS pasangan naik <b>{p("ISPA balita")}</b>, kematian <b>{p("Kematian")}</b>.{first ? <> Fokus: {first.nama}.</> : null}</> },
          { t: "Di hari yang sama", view: at(first, 6.2, 20), values: mean,
            d: <>Efeknya muncul <b>hari itu juga</b>. Jeda 1–3 hari dan uji plasebo tidak bermakna.</> },
          { t: "Balita ≈ lansia", view: "nasional", values: mean,
            d: <>ISPA balita {p("ISPA balita")} dan lansia {p("ISPA lansia")}: kedua kelompok <b>sama rentan</b>.</> },
          { t: `Di atas ${ak.ambang.Kematian}, jantung ikut`, view: "kalimantan", values: per("2026"),
            d: <>Setelah PM2.5 harian lewat <b>{ak.ambang.Kematian} {UG}</b>, kasus jantung dan kematian naik lebih tajam.</> },
        ];
      }
      case "/jaringan": {
        const j = ak.jaringan;
        const beku = Object.values(sc).reduce((a, s) => a + (s.baris_sensor_beku ?? 0), 0);
        const kembar = pairs.pasangan_r099[0];
        // shortcut: daftar prioritas = Tabel 3.5 laporan (build_docx.py); ubah keduanya bersamaan
        const prio = ["BJB-01", "SM2-01", "KTG-02", "JMB-02", "MER-01", "KTB-01"];
        return [
          { t: `${j.Andal} dari 27 andal`, view: "nasional", values: mean, visible: andal,
            d: <>Tiang abu-abu pendek = <b>tidak andal</b>: {j["Diakui metadata"]} diakui metadata, {j["TERSEMBUNYI (status Active)"]} tersembunyi.</> },
          { t: "Beku, tapi berlabel VALID", view: at(byCode["BJB-01"], 6), values: mean, labels: ["BJB-01", "SM2-01"],
            d: <>Banjarbaru membeku <b>{fmt(beku, 0)} jam</b> dengan label VALID. QC yang hanya membaca label tidak menangkapnya.</> },
          { t: "Kandidat kembar", view: at(byCode["KTG-01"], 6.3, 30), values: mean, labels: ["KTG-01", "KTG-02"],
            d: <>Palangka Raya dan Sampit hanya beda level <b>{fmt(kembar["beda_level_%"], 1)}%</b> ({fmt(kembar.jarak_km, 0)} km). Perlu verifikasi lapangan.</> },
          { t: "Titik prioritas", view: "nasional", values: mean, labels: prio,
            d: <>Prioritas: <b>Kalsel & Kaltim</b>, koridor gambut Kalteng, Muaro Jambi, Papua Selatan, jalur asap Sumbar–Riau.</> },
        ];
      }
      default:
        return [];
    }
  }, [d, path, year, pilihan, byCode, andal, sc]);

  if (!d) return <div className="stage3d" style={{ height: 400 }} />;

  // Simulasi: tanpa langkah; tiang = hari terburuk (p95) yang dipotong slider batas.
  if (path === "/aksi") {
    const p95 = Object.fromEntries(d[0].map((s) => [s.code, s.p95_pm25]));
    return (
      <div className="page-stage">
        <Stage3D values={p95} view="rendah" visible={filt} height={380} cap={cap}
          caption={cap != null
            ? <>Tinggi tiang = PM2.5 pada hari-hari terburuk (persentil 95). Bagian transparan = yang <b>dipotong</b> bila batas harian {cap} {UG} ditegakkan.</>
            : <>Tinggi tiang = PM2.5 pada hari-hari terburuk (persentil 95).</>} />
      </div>
    );
  }
  const s = steps[Math.min(i, steps.length - 1)];
  if (!s) return null;

  return (
    <div className="page-stage" data-tour="stage">
      <Stage3D values={s.values ?? {}} view={s.view ?? "nasional"} visible={s.visible ?? filt} labels={s.labels} height={400} />
      {s.years && (
        <span className="stage-years seg" role="group" aria-label="Tahun">
          {(["2024", "2025", "2026"] as Year[]).map((y) => <button key={y} aria-pressed={year === y} onClick={() => setYear(y)}>{y}</button>)}
        </span>
      )}
      <ol className="steps" aria-label="Langkah cerita">
        {steps.map((st, k) => (
          <li key={k}>
            <button aria-current={k === i ? "step" : undefined} onClick={() => setI(k)}>
              <span className="n">{k + 1}</span><b>{st.t}</b>
              <span className="d">{st.d}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
