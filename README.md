# ASAP

Dashboard interaktif kualitas udara dan dampaknya pada kesehatan masyarakat di 27 wilayah Indonesia. Dibuat untuk cabang **Dashboard Analysis Gelar Rasa 2026** (Preliminary Round), dengan tema *"From Roots to Clarity, Revealing Meaningful Insight Through Data"*.


## Isi dashboard

| Halaman | Isi |
|---|---|
| **Ringkasan** | Gambaran umum data: 4 KPI yang mengikuti filter, peta stasiun dengan putar ulang mingguan, sebaran kategori ISPU, cakupan data |
| **Kualitas Udara** | Kondisi PM2.5 per stasiun terhadap baku mutu nasional dan WHO |
| **Pola Waktu** | Grafik garis hingga 3 stasiun (harian/mingguan/bulanan, skala log/linear), musim asap, pola harian |
| **Faktor Pemicu** | Peran musim/episode, lokasi, lalu lintas, dan cuaca |
| **Dampak Kesehatan** | Hubungan PM2.5 dengan kunjungan rumah sakit (ISPA balita, kardiovaskular, kematian) |
| **Jaringan Pemantauan** | Keandalan stasiun dan masalah data yang tersembunyi |
| **Simulasi & Rekomendasi** | Simulator kebijakan (batas PM2.5 → kasus yang bisa dicegah) dan kartu rekomendasi |
| **Tentang Data** | Sumber, aturan pembersihan, dan catatan metodologi |

Fitur pendukung: filter global (Periode, Pulau, Kawasan, Acuan), **Stasiun Pilihan** (maks. 3, tersimpan di URL), drawer Profil Stasiun, Tur Terpandu, dan panel "Temuan utama" di tiap halaman.

## Temuan inti

- 21 dari 24 stasiun melewati baku mutu tahunan; PM2.5 menjadi pencemar kritis pada 99,6% hari.
- Kawasan gambut memburuk +102% (1 Jan–14 Okt, 2024→2026), sedangkan non-gambut hanya +3%.
- Musim/episode menjelaskan 82% variasi PM2.5, lokasi 16%.
- PM2.5 dua kali lipat → ISPA balita +56%, kematian +27%, efeknya muncul di hari yang sama.
- 2 stasiun punya masalah data yang tidak tercatat (mis. BJB-01 membeku 7.329 jam).

## Data & Preprocessing

- Data mentah panitia: `data/aqms/` (27 file AQMS) dan `data/reference/` (6 file).
- Pipeline pembersihan (aturan yang sama dengan dashboard): `preprocessing/preprocess_notebook.py`.
  Jalankan `python preprocessing/preprocess_notebook.py`; hasilnya di `data_notebook/`.
- Panduan lengkap, aturan, dan bukti kecocokan dengan `public/data`: [preprocessing/README.md](preprocessing/README.md).

## Teknologi

- [React 18](https://react.dev) + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vitejs.dev)
- [Apache ECharts](https://echarts.apache.org) untuk grafik dan peta
- React Router untuk navigasi antarhalaman
- Font Fira Sans dan Fira Code (via Fontsource)

## Menjalankan secara lokal

Butuh Node.js 18 atau lebih baru.

```bash
npm install
npm run dev        # http://localhost:5173
```

Build produksi:

```bash
npm run build      # hasil di dist/
npm run preview
```

Deploy: situs statis, siap untuk Vercel (`vercel.json` sudah tersedia).

## Struktur

```
public/data/       data JSON hasil olahan + batas provinsi (indonesia.geojson)
src/pages/         halaman dashboard
src/components/    komponen (peta, grafik garis, pemilih stasiun, dll.)
src/lib/           pemuatan data, format angka, simulator, token tema
```

## Data

- **Dataset panitia** DA Gelar Rasa 2026: data kualitas udara AQMS per jam (sintetis) dan data rumah sakit. Tidak ada dataset lain yang dipakai dalam analisis.
- **Batas provinsi**: [GADM](https://gadm.org) versi 4.1 level 1, disederhanakan, hanya sebagai latar peta.

File JSON di `public/data/` dihasilkan dari notebook analisis (pembersihan data, agregasi, dan model dampak dua tahap) yang disimpan terpisah dari repo ini.
