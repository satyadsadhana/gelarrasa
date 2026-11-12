/**
 * Ikon navigasi, digambar khusus untuk isi tiap halaman (bukan dari pustaka ikon):
 * peta = Ringkasan (isinya peta), garis angin = Kualitas Udara, grafik garis = Pola Waktu,
 * api = Faktor Pemicu (musim kebakaran pemicu terbesar), jantung = Dampak Kesehatan,
 * menara pemancar = Jaringan Pemantauan, penggeser = Simulasi.
 */
const PATHS: Record<string, string> = {
  "/": "M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20",
  "/kondisi": "M3 8.5h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12.5h15a2.5 2.5 0 1 1-2.5 2.5M3 16.5h7",
  "/waktu": "M3 20h18M4 15.5l4.5-5 4 3.5L20 6",
  "/pemicu": "M12 3c.6 3.2 5 5.4 5 10.2A5 5 0 0 1 7 13.2c0-2.3 1.2-3.8 2.3-4.8.3 1.8 1.2 2.9 2.4 3.2-.4-3-.4-5.6.3-8.6z",
  "/dampak": "M12 20s-7.5-4.6-7.5-10.2A4 4 0 0 1 12 7.6a4 4 0 0 1 7.5 2.2C19.5 15.4 12 20 12 20zM7.5 12.5h2.5l1.2-2 1.8 4 1.2-2H17",
  "/jaringan": "M12 11v10M8.5 21h7M8.3 6.8a5 5 0 0 0 0 7M15.7 6.8a5 5 0 0 1 0 7M5.5 4a9 9 0 0 0 0 12.8M18.5 4a9 9 0 0 1 0 12.8M12 9.4a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2z",
  "/aksi": "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  // tabung data (Tentang Data) dan tombol putar (Tur)
  "/tentang": "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  tur: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 8.5v7l5.5-3.5z",
  // tambahan untuk rekomendasi
  rs: "M4 21V7l8-4 8 4v14M9 21v-5h6v5M12 8v5M9.5 10.5h5",
  pemda: "M3 21h18M5 21V10M19 21V10M9.5 21V10M14.5 21V10M2.5 10 12 4l9.5 6z",
  sensor: "M12 13v8M9 21h6M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7.8 6.8a6 6 0 0 0 0 8.4M16.2 6.8a6 6 0 0 1 0 8.4",
  orang: "M12 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM7 21v-6.5A3.5 3.5 0 0 1 10.5 11h3a3.5 3.5 0 0 1 3.5 3.5V21",
  aturan: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
};

export default function NavIcon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[path] ?? ""} />
    </svg>
  );
}
