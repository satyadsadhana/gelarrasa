export type Station = {
  code: string; nama: string; provinsi: string; kota: string; kecamatan: string; pulau: string; kelompok: string;
  gambut: boolean; lat: number; lon: number; site_type: string; karakteristik: string; tipe: string | null;
  status_metadata: string; grade: string; kategori_jaringan: string; masalah: string; hospital_id: string;
  rs_nama: string; rs_kelas: string; rs_tt: number; traffic_per_h: number; jarak_jalan_m: number; tz_offset: number;
  baseline_pm25: number; dikecualikan: boolean; cakupan_rendah: boolean; excl_tren: boolean; simulasi: boolean;
};
export type StationsFile = { stasiun: Station[]; urutan_barcode: string[]; default_pilihan: string[] };

export type Summary = {
  code: string; rata2_pm25: number; p95_pm25: number; hari_valid: number; pct_hari_gt55: number; pct_hari_gt15: number;
  hari_gt150: number; kelompok: string; pulau: string; lonjakan: number; musiman: number; tipe: string;
  periode_2024: number | null; periode_2025: number | null; periode_2026: number | null;
  "ubah_%": number | null; "ubah_janjun_%": number | null; "ubah_julokt_%": number | null; iku_2025: number | null;
  kategori_ispu_pct: Record<string, number>;
};

export type Daily = { mulai: string; n: number; pm25: Record<string, (number | null)[]> };
export type Weekly = { minggu: string[]; pm25: Record<string, (number | null)[]> };

export type AngkaKunci = {
  tahunan: Record<string, { stasiun_sah: number; lampaui_baku_mutu_15: number; belum_capai_IT1_35: number }>;
  tren_1jan_14okt: Record<string, { "2024": number; "2026": number; "ubah_%": number }>;
  puncak_bulanan_gambut: Record<string, number>;
  episode_berat: Record<string, { jumlah: number; total_hari: number }>;
  dekomposisi_variasi_: Record<string, number>;
  rr_per_lipat_dua: Record<string, { rr: number; ci: [number, number] }>;
  beban_2025_batas55: Record<string, { kasus: number; persen: number }>;
  jaringan: Record<string, number>;
  [k: string]: unknown;
};

export type HospitalDaily = {
  mulai: string; n: number; outcome: string[]; label: Record<string, string>; model: string[];
  rs: Record<string, { code: string; pm25: (number | null)[] } & Record<string, (number | null)[]>>;
};
export type ModelDampak = {
  b_gabungan: Record<string, number>;
  b_per_rs: Record<string, Record<string, number>>;
  ambang: Record<string, { T: number; b_log: number; b_h: number } | string>;
};
