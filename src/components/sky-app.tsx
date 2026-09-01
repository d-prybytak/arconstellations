import { useEffect, useRef, useState } from "react";
import { SkyHud } from "@/components/sky-hud";
import { loadSkyCatalog } from "@/lib/sky/catalog";
import type { SkyEngine } from "@/lib/sky/engine";

export function SkyApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SkyEngine | null>(null);
  const [, setEngineTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const labelsEl = labelsRef.current;
    const overlayEl = overlayRef.current;
    if (!canvas || !labelsEl || !overlayEl) return;
    let cancelled = false;
    let engine: SkyEngine | null = null;
    void Promise.all([import("@/lib/sky/engine"), loadSkyCatalog()]).then(([{ SkyEngine }]) => {
      if (cancelled) return;
      engine = new SkyEngine({ canvas, labelsEl, overlayEl });
      engineRef.current = engine;
      setEngineTick((n) => n + 1);
      void engine.start();
    });
    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none"
        aria-label="Celestial sphere"
      />
      <div ref={labelsRef} className="pointer-events-none absolute inset-0 z-[1]" />
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 z-[2] flex flex-col"
      >
        <SkyHud engineRef={engineRef} />
      </div>
    </div>
  );
}
