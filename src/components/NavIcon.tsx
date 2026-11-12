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
};

export default function NavIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[path] ?? ""} />
    </svg>
  );
}
