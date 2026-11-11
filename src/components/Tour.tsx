import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

const STEPS = [
  { path: "/", target: "map", text: "Ini 27 stasiun pemantau di 21 provinsi. Ukuran & warna titik = PM2.5. Tekan ▶ untuk memutar 2024 → 2026. Filter di atas mengubah semua angka." },
  { path: "/kondisi", target: "main", text: "Marunda tercemar setiap hari. Palangka Raya normal, lalu meledak saat musim asap." },
  { path: "/waktu", target: "main", text: "Pilih hingga 3 stasiun dan resolusi waktu. Bandingkan Palangka Raya dengan Marunda: yang satu meledak tiap Agustus, yang lain tinggi sepanjang tahun." },
  { path: "/pemicu", target: "main", text: "82% variasi PM2.5 berasal dari musim & episode, bukan dari cuaca harian." },
  { path: "/dampak", target: "main", text: "PM2.5 berlipat dua → ISPA balita +56%, di hari yang sama. Di atas 150 µg/m³ kematian melonjak." },
  { path: "/jaringan", target: "main", text: "Sensor Banjarbaru beku 7.329 jam (±10 bulan), tapi tetap berlabel VALID." },
  { path: "/aksi", target: "main", text: "Coba sendiri: geser batas PM2.5 dan lihat berapa kasus yang bisa dicegah." },
];
const KEY = "nn-tour-seen";

type T = { start: () => void };
const C = createContext<T>({ start: () => {} });
export const useTour = () => useContext(C);

export function TourProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<number | null>(null);
  const nav = useNavigate();
  const capture = new URLSearchParams(location.search).has("capture");

  useEffect(() => {
    if (capture) return;
    try { if (!localStorage.getItem(KEY)) setTimeout(() => setStep(0), 900); } catch { /* storage diblokir */ }
  }, [capture]);

  useEffect(() => {
    if (step == null) return;
    const s = STEPS[step];
    nav(s.path + location.search);
    let el: Element | null = null;
    const t = setTimeout(() => {
      el = document.querySelector(`[data-tour="${s.target}"]`);
      el?.classList.add("tour-focus");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
    return () => { clearTimeout(t); el?.classList.remove("tour-focus"); };
  }, [step, nav]);

  const end = () => { setStep(null); try { localStorage.setItem(KEY, "1"); } catch { /* abaikan */ } };
  return (
    <C.Provider value={{ start: () => setStep(0) }}>
      {children}
      {step != null && (
        <div className="tour" role="dialog" aria-label="Tur terpandu">
          <p>{STEPS[step].text}</p>
          <div className="row">
            <span>Langkah {step + 1} dari {STEPS.length}</span>
            <span>
              <button className="skip" onClick={end}>Lewati</button>
              {step > 0 && <button className="skip" onClick={() => setStep(step - 1)}>← Kembali</button>}
              <button className="next" onClick={() => (step + 1 < STEPS.length ? setStep(step + 1) : end())}>
                {step + 1 < STEPS.length ? "Lanjut →" : "Selesai"}
              </button>
            </span>
          </div>
        </div>
      )}
    </C.Provider>
  );
}
