# Preprocessing Dataset (Sumber Angka Dashboard)

Satu-satunya pipeline pembersihan data untuk dashboard **dan** laporan. Semua analisis lanjutan
wajib memakai keluaran folder `data_notebook/` supaya angkanya sama dengan dashboard.

## Cara menjalankan

```bash
pip install pandas numpy
python preprocessing/preprocess_notebook.py      # dari root repo, ±1–2 menit
```

| Masukan | Isi |
|---|---|
| `data/aqms/*.csv` | 27 file AQMS mentah dari panitia (per jam, 6 polutan + 4 cuaca + qc_flag) |
| `data/reference/*.csv` | 6 file: HLT-01 (kesehatan harian), sites, sensors, hospitals, metadata_sensors, metadata_dates |

## Aturan (sama dengan halaman Tentang Data / `src/pages/Tentang.tsx`)

1. **Format**: teks error & `inf` → kosong; sentinel (−9999, −999, 999, 9999, 50000, 100000, −273,2, 999,9) → kosong.
   Satuan ppm (MDN-01, PSW-01, BJB-01): PM ×1000; gas ×BM×1000/24,45 (25 °C, 1 atm). Satuan PM-nya diasumsikan.
2. **QC**: VALID dipakai; SUSPECT ikut dipakai bila median PM2.5-nya 0,85–1,15× median VALID (per stasiun).
3. **Fisik**: polutan negatif, PM2.5 > PM10, RH di luar 0–100, suhu di luar −5–50 °C, arah angin di luar 0–360 → kosong.
4. **Sensor beku**: polutan bernilai identik ≥24 rekaman berturut-turut → kosong (BJB-01: 7.329 jam).
5. **Waktu**: floor ke jam, rata-rata per jam, grid 1 jam penuh 1 Jan 2024 00:00 – 14 Okt 2026 23:00,
   celah ≤3 jam diinterpolasi (arah angin: rata-rata sirkular, tanpa interpolasi).
6. **Agregat**: nilai harian sah bila ≥18 jam; rata-rata tahunan sah bila ≥75% hari.

## Keluaran `data_notebook/`

| File | 1 baris = | Catatan |
|---|---|---|
| `aqms_harian.csv` | stasiun × hari | 6 polutan + cuaca, `jam_valid_pm25`, `pm25_maks_1jam`, `kategori_ispu_pm25` |
| `panel_harian.csv` | RS × hari | 7 kasus kesehatan + cuaca RS + polutan stasiun pasangan + `pm25_lag1..7` |
| `master_stasiun.csv` | stasiun | sensors + sites + hospitals; pasangan resmi SENS-0nn ↔ RS-XXX-nn |
| `log_preprocessing.csv` | stasiun | baris mentah, VALID, SUSPECT (rasio & dipakai/tidak), teks error, sentinel, jam beku, jam diinterpolasi, hari sah |
| `validasi.json` | — | hasil cek terhadap `public/data` (harus `"LULUS": true`) |
| `aqms_per_jam.csv` | stasiun × jam | ±65 MB, **tidak di-commit**; dibuat ulang saat skrip dijalankan |

## Bukti konsisten dengan dashboard (`validasi.json`)

| Cek | Hasil pipeline | Dashboard (`public/data`) |
|---|---|---|
| PM2.5 harian 27 stasiun (`daily.json`) | 0 hari berbeda (selisih ≤0,05 = pembulatan) | sama |
| Rata-rata per stasiun (`station_summary.json`) | selisih maks 0,005 | sama |
| Stasiun di atas baku mutu tahunan 2025 (`annual.json`) | 21 dari 24 | 21 dari 24 |
| Hari episode asap berat 2024/2025/2026 (`episodes.json`) | 84 / 89 / 198 | 84 / 89 / 198 |
| Jumlah kasus kesehatan setelah join | tidak berubah | — |

## Catatan untuk laporan

- **Interpolasi besar**: MDN-01 (Medan) ±6.657 jam (27%), SM2-01 (Samarinda) 1.917 jam, PLB-01 3.696 jam.
- **SUSPECT tidak dipakai** di SM2-01 (berisi 999), MDN-01, MER-01, BJB-01, JMB-02.
- **Tidak layak dianalisis**: JMB-02 (0 hari sah), MER-01 (10 hari sah).
- **Belum tercakup skrip ini**: model dampak kesehatan (RR, dosis-respons, simulasi), SHAP, dekomposisi,
  dan tipologi. Angkanya di `public/data` berasal dari notebook tim yang belum diunggah.
