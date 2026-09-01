import type { RefObject } from "react";
import { cardinalFromAz } from "@/lib/sky/astro";
import type { SkyEngine } from "@/lib/sky/engine";
import { useSkyStore } from "@/lib/sky/store";
import { cn } from "@/lib/utils";

const PX = 2.8;
const CARDINALS = [
  { az: 0, label: "N" },
  { az: 90, label: "E" },
  { az: 180, label: "S" },
  { az: 270, label: "W" },
];

type EngineRef = RefObject<SkyEngine | null>;

export function SkyCompass({ engineRef }: { engineRef: EngineRef }) {
  const viewAz = useSkyStore((s) => s.viewAz);
  const dragging = useSkyStore((s) => s.dragging);
  const cardinal = cardinalFromAz(viewAz);

  const copies = [-360, 0, 360];
  const ticks: { az: number; major: boolean; copy: number }[] = [];
  for (const copy of copies) {
    for (let a = 0; a < 360; a += 15) {
      ticks.push({ az: a, major: a % 90 === 0, copy });
    }
  }

  function lookTo(az: number) {
    engineRef.current?.lookAzimuth(az);
  }

  return (
    <div
      className={cn("sky-compass pointer-events-auto", dragging && "opacity-70")}
      aria-label={`Facing ${Math.round(viewAz)} degrees ${cardinal}`}
    >
      <div className="sky-compass-readout">
        <span className="tabular-nums">{Math.round(viewAz)}°</span>
        <span>{cardinal}</span>
      </div>
      <div className="sky-compass-track">
        <div
          className="sky-compass-inner"
          style={{ transform: `translateX(${-viewAz * PX}px)` }}
        >
          {ticks.map((t) => {
            const x = (t.az + t.copy) * PX;
            const cardinalMark = CARDINALS.find((c) => c.az === t.az);
            if (cardinalMark) {
              if (t.copy !== 0) {
                return (
                  <span
                    key={`${t.copy}-${t.az}`}
                    className="sky-compass-cardinal"
                    style={{ left: x }}
                    aria-hidden
                  >
                    {cardinalMark.label}
                  </span>
                );
              }
              return (
                <button
                  key={`${t.copy}-${t.az}`}
                  type="button"
                  className="sky-compass-cardinal"
                  style={{ left: x }}
                  onClick={() => lookTo(t.az)}
                >
                  {cardinalMark.label}
                </button>
              );
            }
            return (
              <span
                key={`${t.copy}-${t.az}`}
                className={cn("sky-compass-tick", t.az % 30 === 0 && "sky-compass-tick-mid")}
                style={{ left: x }}
              />
            );
          })}
        </div>
        <div className="sky-compass-notch" />
      </div>
    </div>
  );
}
