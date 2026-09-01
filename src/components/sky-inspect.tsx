import { X } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  bvToRgb,
  formatAlt,
  formatAz,
  formatDec,
  formatRA,
  spectralFromBv,
} from "@/lib/sky/astro";
import { namedMembers } from "@/lib/sky/catalog";
import { asterismsFor, constellationBlurb, spectralLine } from "@/lib/sky/copy";
import type { SkyEngine } from "@/lib/sky/engine";
import { useSkyStore } from "@/lib/sky/store";
import { useCatalog } from "@/lib/sky/use-catalog";

type EngineRef = RefObject<SkyEngine | null>;

export function InspectPanel({ engineRef }: { engineRef: EngineRef }) {
  const selected = useSkyStore((s) => s.selected);
  const catalog = useCatalog();
  if (!selected) return null;

  const con =
    selected.kind === "star" && selected.con
      ? catalog?.constellations.find((c) => c.id === selected.con)
      : selected.kind === "constellation"
        ? catalog?.constellations.find((c) => c.id === selected.id)
        : undefined;
  const members =
    selected.kind === "constellation" && catalog
      ? namedMembers(catalog.stars, selected.id, 8)
      : [];
  const related =
    selected.kind === "constellation" ? asterismsFor(selected.id) : [];

  const kicker =
    selected.kind === "body"
      ? "A wanderer"
      : selected.kind === "dso"
        ? selected.kindLabel
        : "Drawn from the vault";

  return (
    <div className="sky-inspect-enter pointer-events-auto mx-auto w-full max-w-lg rounded-xl bg-surface px-4 py-3 shadow-[0_0_0_1px_rgb(232_234_238/0.08)] sm:px-5 sm:py-4">
      <p className="text-xs font-medium tracking-widest text-subtle uppercase">{kicker}</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight tracking-tight">{selected.name}</p>
          <p className="mt-1 text-xs font-medium tracking-widest text-muted uppercase">
            {selected.kind === "star"
              ? [
                  selected.bayer && selected.con
                    ? `${selected.bayer} ${selected.con}`
                    : selected.con,
                  spectralLine(spectralFromBv(selected.bv)),
                  `mag ${selected.mag.toFixed(2)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : selected.kind === "constellation"
                ? `${selected.gen} · ${selected.id}`
                : selected.kind === "body"
                  ? `mag ${selected.mag.toFixed(1)}`
                  : selected.id}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label="Return to the sky"
          onClick={() => engineRef.current?.dismissPresent()}
        >
          <X className="size-4" />
        </Button>
      </div>

      {selected.kind === "constellation" ? (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
          {constellationBlurb(selected.id, selected.meaning)}
        </p>
      ) : null}

      {selected.kind === "star" ? (
        <div className="mt-2 flex items-center gap-3">
          <SpectralPip bv={selected.bv} />
          <p className="text-sm text-muted">
            {spectralLine(spectralFromBv(selected.bv))}. Magnitude {selected.mag.toFixed(2)}.
          </p>
        </div>
      ) : null}

      {selected.kind === "body" || selected.kind === "dso" ? (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{selected.info}</p>
      ) : null}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        {selected.kind === "star" ? (
          <>
            <Stat label="Right ascension" value={formatRA(selected.ra)} />
            <Stat label="Declination" value={formatDec(selected.dec)} />
            {selected.alt != null ? (
              <Stat label="Altitude" value={formatAlt(selected.alt)} />
            ) : (
              <Stat label="HIP" value={String(selected.hip)} />
            )}
            {selected.az != null ? (
              <Stat label="Azimuth" value={formatAz(selected.az)} />
            ) : (
              <Stat label="B−V" value={selected.bv.toFixed(2)} />
            )}
          </>
        ) : selected.kind === "constellation" ? (
          <>
            <Stat label="IAU" value={selected.id} />
            <Stat label="Stars on chart" value={String(selected.starCount)} />
            <Stat label="Right ascension" value={formatRA(selected.ra)} />
            <Stat label="Declination" value={formatDec(selected.dec)} />
          </>
        ) : (
          <>
            <Stat label="Right ascension" value={formatRA(selected.ra)} />
            <Stat label="Declination" value={formatDec(selected.dec)} />
            {selected.kind === "body" && selected.alt != null ? (
              <Stat label="Altitude" value={formatAlt(selected.alt)} />
            ) : (
              <Stat label="Kind" value={selected.kind === "dso" ? selected.kindLabel : "Solar"} />
            )}
            {selected.kind === "body" && selected.az != null ? (
              <Stat label="Azimuth" value={formatAz(selected.az)} />
            ) : (
              <Stat label="Catalogue" value={selected.id} />
            )}
          </>
        )}
      </dl>

      {related.length > 0 ? (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
          {related.map((a) => a.name).join(" · ")}
          {related[0] ? ` — ${related[0].blurb}` : ""}
        </p>
      ) : null}

      {selected.kind === "star" && con ? (
        <Button
          variant="secondary"
          className="mt-3 w-full"
          onClick={() => engineRef.current?.selectConstellation(con.id)}
        >
          Gather {con.name}
        </Button>
      ) : null}

      {members.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium tracking-widest text-subtle uppercase">
            Brightest members
          </p>
          <div className="sky-h-scroll mt-2">
            {members.map((star) => (
              <button
                key={star.hip}
                type="button"
                className="sky-member"
                onClick={() => engineRef.current?.selectStarByHip(star.hip)}
              >
                <SpectralPip bv={star.bv} />
                <span className="text-sm">{star.name}</span>
                <span className="text-xs tabular-nums text-muted">
                  {star.mag.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-widest text-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function SpectralPip({ bv }: { bv: number }) {
  const [r, g, b] = bvToRgb(bv);
  return (
    <span
      className="sky-pip"
      style={{ background: `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})` }}
    />
  );
}
