"""
Preprocessing dataset DA Gelar Rasa 2026 dengan ATURAN NOTEBOOK TIM (sumber angka dashboard).

Aturan diambil dari src/pages/Tentang.tsx (daftar STEPS) dan dibuktikan identik dengan
public/data/*.json (PM2.5 harian, rata-rata stasiun, tahunan, episode):
  1. Format  : teks error & inf -> kosong; sentinel -> kosong; ppm -> ug/m3
               (PM x1000; gas pada 25 C, 1 atm: ppm x BM x 1000 / 24,45)
  2. QC      : VALID dipakai; SUSPECT ikut dipakai bila median PM2.5-nya 0,85-1,15x median VALID
  3. Fisik   : polutan negatif, PM2.5 > PM10, RH di luar 0-100, suhu di luar -5..50,
               arah angin di luar 0-360, angin negatif -> kosong
  4. Beku    : polutan bernilai identik >=24 rekaman berturut-turut -> kosong
  5. Waktu   : floor ke jam, rata-rata per jam, grid 1 jam penuh 2024-01-01 00:00 .. 2026-10-14 23:00,
               celah <=3 jam diinterpolasi (arah angin tidak diinterpolasi)
  6. Agregat : nilai harian sah bila >=18 jam; tahunan sah bila >=75% hari

Jalankan dari root repo:   python preprocessing/preprocess_notebook.py
Masukan : data/aqms/*.csv (27 file) dan data/reference/*.csv (6 file)
Keluaran: data_notebook/  (lihat preprocessing/README.md)
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW, REF = ROOT / "data" / "aqms", ROOT / "data" / "reference"
DASH = ROOT / "public" / "data"
OUT = ROOT / "data_notebook"
OUT.mkdir(exist_ok=True)

POL = ["pm25", "pm10", "so2", "co", "o3", "no2"]
MET = ["temperature_c", "humidity_pct", "wind_speed_ms", "wind_direction_deg"]
BM = {"so2": 64.066, "co": 28.01, "o3": 48.00, "no2": 46.0055}  # berat molekul (g/mol)
SENTINEL = [-9999, -999, 999, 9999, 50000, 100000, -273.2, 999.9]
GRID = pd.date_range("2024-01-01 00:00", "2026-10-14 23:00", freq="h")
ISPU_BP = [(15.5, "Baik"), (55.4, "Sedang"), (150.4, "Tidak Sehat"), (250.4, "Sangat Tidak Sehat"), (np.inf, "Berbahaya")]


def kategori(v):
    if pd.isna(v):
        return None
    return next(lab for lim, lab in ISPU_BP if v <= lim)


def bersihkan_stasiun(f: Path):
    d = pd.read_csv(f, dtype=str)
    code = "-".join(f.name.split("_")[0].split("-")[:2])
    ppm = any(c.endswith("_ppm") for c in d.columns)
    x = pd.DataFrame({"t": pd.to_datetime(d["timestamp_start"], errors="coerce"),
                      "te": pd.to_datetime(d["timestamp_end"], errors="coerce"),
                      "qc": d["qc_flag"].str.upper().str.strip()})
    n_err = n_sent = 0
    for p in POL + MET:
        col = next(c for c in d.columns if c == p or c.startswith(p + "_"))
        raw = d[col]
        v = pd.to_numeric(raw, errors="coerce")
        n_err += int((raw.notna() & v.isna()).sum())
        bad = v.isin(SENTINEL) | ~np.isfinite(v)
        n_sent += int((bad & v.notna()).sum())
        v[bad] = np.nan
        if ppm and p in POL:
            v = v * 1000 if p in ("pm25", "pm10") else v * BM[p] * 1000 / 24.45
        x[p] = v
    ok_time = x.t.notna() & (x.t.dt.year >= 2023) & ((x.te - x.t).dt.total_seconds() > 0)
    med_v = x.loc[(x.qc == "VALID") & ok_time, "pm25"].median()
    med_s = x.loc[(x.qc == "SUSPECT") & ok_time, "pm25"].median()
    rasio = float(med_s / med_v) if pd.notna(med_s) and med_v else None
    pakai_suspect = bool(rasio is not None and 0.85 <= rasio <= 1.15)
    keep = ok_time & ((x.qc == "VALID") | ((x.qc == "SUSPECT") & pakai_suspect))
    log = {"kode_stasiun": code, "satuan_asli": "ppm" if ppm else "ug/m3", "baris_mentah": len(d),
           "baris_valid": int((x.qc == "VALID").sum()), "baris_suspect": int((x.qc == "SUSPECT").sum()),
           "rasio_suspect_valid": None if rasio is None else round(rasio, 3), "suspect_dipakai": pakai_suspect,
           "waktu_rusak": int((~ok_time).sum()), "sel_teks_error": n_err, "sel_sentinel": n_sent}
    x = x[keep].sort_values("t").reset_index(drop=True)
    # fisik
    for p in POL:
        x.loc[x[p] < 0, p] = np.nan
    log["baris_pm25_gt_pm10"] = int((x.pm25 > x.pm10).sum())
    x.loc[x.pm25 > x.pm10, "pm25"] = np.nan
    x.loc[(x.humidity_pct < 0) | (x.humidity_pct > 100), "humidity_pct"] = np.nan
    x.loc[(x.temperature_c < -5) | (x.temperature_c > 50), "temperature_c"] = np.nan
    x.loc[(x.wind_direction_deg < 0) | (x.wind_direction_deg > 360), "wind_direction_deg"] = np.nan
    x.loc[x.wind_speed_ms < 0, "wind_speed_ms"] = np.nan
    # sensor beku (polutan)
    for p in POL:
        g = (x[p] != x[p].shift()).cumsum()
        run = x.groupby(g)[p].transform("size")
        beku = (run >= 24) & x[p].notna()
        if p == "pm25":
            log["jam_beku_pm25"] = int(beku.sum())
        x.loc[beku, p] = np.nan
    # per jam
    x["h"] = x.t.dt.floor("h")
    rad = np.deg2rad(x.wind_direction_deg)
    x["_s"], x["_c"] = np.sin(rad), np.cos(rad)
    hr = x.groupby("h")[POL + MET[:3] + ["_s", "_c"]].mean().reindex(GRID)
    hr["wind_direction_deg"] = (np.rad2deg(np.arctan2(hr._s, hr._c)) + 360) % 360
    hr = hr.drop(columns=["_s", "_c"])
    flag = pd.Series(False, index=GRID)
    for p in POL + MET[:3]:
        na = hr[p].isna()
        gid = (na != na.shift()).cumsum()
        short = na & (na.groupby(gid).transform("sum") <= 3)
        filled = hr[p].interpolate(limit_area="inside")
        hr.loc[short, p] = filled[short]
        if p == "pm25":
            flag = short & hr[p].notna()
    hr["pm25_diinterpolasi"] = flag
    log["jam_pm25_diinterpolasi"] = int(flag.sum())
    hr.insert(0, "kode_stasiun", code)
    hr.index.name = "waktu"
    # harian
    day = hr.index.floor("D")
    cnt = hr[POL + MET].notna().groupby(day).sum()
    harian = hr[POL + MET].groupby(day).mean().where(cnt >= 18)
    harian["wind_direction_deg"] = hr["wind_direction_deg"].groupby(day).apply(
        lambda s: (np.rad2deg(np.arctan2(np.sin(np.deg2rad(s)).mean(), np.cos(np.deg2rad(s)).mean())) + 360) % 360 if s.notna().sum() >= 18 else np.nan)
    harian["jam_valid_pm25"] = cnt["pm25"]
    harian["pm25_maks_1jam"] = hr["pm25"].groupby(day).max().where(cnt["pm25"] >= 18)
    harian["kategori_ispu_pm25"] = harian["pm25"].map(kategori)
    harian.insert(0, "kode_stasiun", code)
    harian.index.name = "tanggal"
    log["hari_sah_pm25"] = int(harian["pm25"].notna().sum())
    return hr, harian, log


def main():
    jam, hari, logs = [], [], []
    for f in sorted(RAW.glob("*_AQMS.csv")):
        h, d, lg = bersihkan_stasiun(f)
        jam.append(h); hari.append(d); logs.append(lg)
        print(f"  {lg['kode_stasiun']}: hari sah PM2.5 = {lg['hari_sah_pm25']}")
    jam = pd.concat(jam).reset_index()
    hari = pd.concat(hari).reset_index()
    jam.to_csv(OUT / "aqms_per_jam.csv", index=False, float_format="%.3f")
    hari.to_csv(OUT / "aqms_harian.csv", index=False, float_format="%.3f")
    pd.DataFrame(logs).to_csv(OUT / "log_preprocessing.csv", index=False)

    # master stasiun
    sites = pd.read_csv(REF / "sites.csv")
    sensors = pd.read_csv(REF / "sensors.csv")
    hosp = pd.read_csv(REF / "hospitals.csv")
    m = sensors.merge(sites, on="location_id", how="left", suffixes=("", "_site"))
    m.insert(0, "kode_stasiun", m["location_id"].str.replace("LOC-", "", regex=False))
    m["hospital_id"] = "RS-XXX-" + m["sensor_id"].str[-2:]  # pasangan resmi SENS-0nn <-> RS-XXX-nn
    m = m.merge(hosp, on="hospital_id", how="left", suffixes=("", "_rs"))
    m.to_csv(OUT / "master_stasiun.csv", index=False)

    # panel RS x hari + paparan stasiun pasangan + lag
    hlt = pd.read_csv(REF / "HLT-01_health_outcomes_daily.csv", parse_dates=["date"])
    hlt = hlt[(hlt.date >= "2024-01-01") & (hlt.date <= "2026-10-14")]
    n_kasus = hlt[["resp", "cvd", "death"]].sum().to_dict()
    pair = m[["kode_stasiun", "hospital_id"]]
    exp = hari.rename(columns={"tanggal": "date"})[["kode_stasiun", "date"] + POL]
    panel = hlt.merge(pair, on="hospital_id", how="left").merge(exp, on=["kode_stasiun", "date"], how="left")
    panel = panel.sort_values(["hospital_id", "date"])
    for k in range(1, 8):
        panel[f"pm25_lag{k}"] = panel.groupby("hospital_id")["pm25"].shift(k)
    panel.to_csv(OUT / "panel_harian.csv", index=False, float_format="%.3f")
    assert panel[["resp", "cvd", "death"]].sum().to_dict() == n_kasus, "jumlah kasus berubah setelah join"
    assert not panel.duplicated(["hospital_id", "date"]).any()

    # ---------- validasi terhadap dashboard ----------
    v = {}
    if DASH.exists():
        dj = json.load(open(DASH / "daily.json", encoding="utf-8"))
        idx = pd.date_range(dj["mulai"], periods=dj["n"])
        beda = 0
        for code, arr in dj["pm25"].items():
            a = pd.Series(arr, index=idx, dtype=float)
            # JSON dibulatkan 1 desimal; selisih <= 0,05 hanyalah beda pembulatan (mis. 18,05 -> 18,1)
            b = hari[hari.kode_stasiun == code].set_index("tanggal")["pm25"].reindex(idx)
            beda += int(((a - b).abs() > 0.0501).sum() + (a.isna() != b.isna()).sum())
        v["daily_json_hari_berbeda"] = beda
        summ = {s["code"]: s["rata2_pm25"] for s in json.load(open(DASH / "station_summary.json", encoding="utf-8"))}
        mean = hari.groupby("kode_stasiun")["pm25"].mean()
        v["rata2_stasiun_selisih_maks"] = round(float(max(abs(mean[c] - s) for c, s in summ.items())), 3)
        ann = json.load(open(DASH / "annual.json", encoding="utf-8"))["per_stasiun"]
        h25 = hari[hari.tanggal.dt.year == 2025].groupby("kode_stasiun")["pm25"].agg(["mean", "count"])
        h25 = h25[h25["count"] >= 0.75 * 365]
        v["tahunan_2025"] = {"replikasi": f"{int((h25['mean'] > 15).sum())}/{len(h25)}",
                             "dashboard": f"{sum(r['lampaui_PP22'] for r in ann if r['tahun'] == 2025 and r['lengkap'])}/{sum(r['lengkap'] for r in ann if r['tahun'] == 2025)}"}
        ep = {}
        for y in (2024, 2025, 2026):
            tot = 0
            for _, g in hari[hari.tanggal.dt.year == y].groupby("kode_stasiun"):
                run = 0
                for val in list(g["pm25"]) + [np.nan]:
                    if pd.notna(val) and val > 150.4:
                        run += 1
                    else:
                        tot += run if run >= 3 else 0
                        run = 0
            ep[y] = tot
        v["episode_hari"] = {"replikasi": ep, "dashboard": {p["tahun"]: p["total_hari"] for p in json.load(open(DASH / "episodes.json", encoding="utf-8"))["per_tahun"]}}
        v["LULUS"] = bool(beda == 0 and v["rata2_stasiun_selisih_maks"] < 0.01
                          and v["tahunan_2025"]["replikasi"] == v["tahunan_2025"]["dashboard"]
                          and all(ep[y] == v["episode_hari"]["dashboard"][y] for y in ep))
    v["kasus_tidak_berubah_setelah_join"] = True
    json.dump(v, open(OUT / "validasi.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)
    print(json.dumps(v, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
