import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import { TourProvider } from "./components/Tour";
import Profil from "./components/Profil";
import ErrorBoundary from "./components/ErrorBoundary";
import { StateProvider } from "./lib/state";
import { useData } from "./lib/data";
import type { StationsFile } from "./lib/types";

const Beranda = lazy(() => import("./pages/Beranda"));
const Q1 = lazy(() => import("./pages/Q1Kondisi"));
const Q2 = lazy(() => import("./pages/Q2Waktu"));
const Q3 = lazy(() => import("./pages/Q3Pemicu"));
const Q4 = lazy(() => import("./pages/Q4Dampak"));
const Q5 = lazy(() => import("./pages/Q5Jaringan"));
const Q6 = lazy(() => import("./pages/Q6Aksi"));
const Tentang = lazy(() => import("./pages/Tentang"));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function Shell() {
  const d = useData<[StationsFile]>("stations");
  if (!d) return <div className="loading">Memuat data…</div>;
  return (
    <StateProvider stations={d[0].stasiun}>
      <TourProvider>
        <ScrollTop />
        <Layout>
          <ErrorBoundary><Suspense fallback={<div className="loading">Memuat halaman…</div>}>
            <Routes>
              <Route path="/" element={<Beranda />} />
              <Route path="/kondisi" element={<Q1 />} />
              <Route path="/waktu" element={<Q2 />} />
              <Route path="/pemicu" element={<Q3 />} />
              <Route path="/dampak" element={<Q4 />} />
              <Route path="/jaringan" element={<Q5 />} />
              <Route path="/aksi" element={<Q6 />} />
              <Route path="/tentang" element={<Tentang />} />
              <Route path="*" element={<Beranda />} />
            </Routes>
          </Suspense></ErrorBoundary>
        </Layout>
        <ErrorBoundary><Profil /></ErrorBoundary>
      </TourProvider>
    </StateProvider>
  );
}

export default function App() {
  return <BrowserRouter><Shell /></BrowserRouter>;
}
