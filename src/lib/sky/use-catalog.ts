import { useEffect, useState } from "react";
import { loadSkyCatalog } from "./catalog";
import type { SkyCatalog } from "./types";

export function useCatalog() {
  const [catalog, setCatalog] = useState<SkyCatalog | null>(null);
  useEffect(() => {
    void loadSkyCatalog().then(setCatalog);
  }, []);
  return catalog;
}
