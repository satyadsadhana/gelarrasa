import { useEffect, useState } from "react";

const cache = new Map<string, Promise<unknown>>();
export function load<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    cache.set(name, fetch(`/data/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`Gagal memuat ${name}`);
      return r.json();
    }));
  }
  return cache.get(name) as Promise<T>;
}

/** Muat beberapa file JSON sekaligus; null selama belum siap. */
export function useData<T extends unknown[]>(...names: string[]): T | null {
  const [d, setD] = useState<T | null>(null);
  const key = names.join(",");
  useEffect(() => {
    let alive = true;
    Promise.all(names.map((n) => load(n))).then((v) => alive && setD(v as T));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return d;
}
