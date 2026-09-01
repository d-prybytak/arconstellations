import { useMemo, useState, type RefObject } from "react";
import { MapPin, Pause, Play, X } from "lucide-react";
import { ConstellationGlyph } from "@/components/constellation-glyph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatAlt,
  formatCoord,
  formatLst,
  formatRA,
  lstHours,
  motionLabel,
  spectralFromBv,
} from "@/lib/sky/astro";
import {
  brightNamedStars,
  constellationAlt,
  featuredIndoor,
  groupBySeason,
  pickTonight,
  searchConstellations,
  searchStars,
  skyRows,
  upNow,
} from "@/lib/sky/catalog";
import { CITIES, CITY_GROUPS, cityByName } from "@/lib/sky/cities";
import { MAG_NOTES, constellationBlurb } from "@/lib/sky/copy";
import { DEEP_SKY, searchBodies, searchDeepSky, solarSystem } from "@/lib/sky/bodies";
import type { SkyEngine } from "@/lib/sky/engine";
import { useSkyStore, type AtlasTab } from "@/lib/sky/store";
import { useCatalog } from "@/lib/sky/use-catalog";
import type { Constellation, Star } from "@/lib/sky/types";
import { cn } from "@/lib/utils";

type EngineRef = RefObject<SkyEngine | null>;

function offsetToLocalHour(hour: number) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return (target.getTime() - now.getTime()) / 3_600_000;
}

export function Sheets({ engineRef }: { engineRef: EngineRef }) {
  const panel = useSkyStore((s) => s.panel);
  const setPanel = useSkyStore((s) => s.setPanel);
  const title =
    panel === "atlas"
      ? "Atlas"
      : panel === "place"
        ? "Place"
        : panel === "night"
          ? "Night"
          : panel === "settings"
            ? "Chart"
            : "Atlas";

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <button
        type="button"
        aria-label="Close"
        className="sky-sheet-backdrop"
        data-open={panel ? "true" : "false"}
        aria-hidden={!panel}
        tabIndex={panel ? 0 : -1}
        onClick={() => setPanel(null)}
      />
      <div
        className="sky-sheet-panel"
        data-open={panel ? "true" : "false"}
        role="dialog"
        aria-modal={panel ? true : undefined}
        aria-labelledby="sky-sheet-title"
        aria-hidden={!panel}
        {...(!panel ? { inert: true } : {})}
      >
        <div className="sky-panel mx-auto max-w-lg overflow-hidden rounded-xl px-4 pb-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong" />
          <div className="flex items-center justify-between gap-3">
            <h2 id="sky-sheet-title" className="font-display text-2xl tracking-tight">
              {title}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Close"
              onClick={() => setPanel(null)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="mt-3 max-h-[min(52dvh,28rem)] overflow-y-auto overscroll-contain">
            {panel === "atlas" ? <AtlasSheet engineRef={engineRef} /> : null}
            {panel === "place" ? <PlaceSheet engineRef={engineRef} /> : null}
            {panel === "night" ? <NightSheet engineRef={engineRef} /> : null}
            {panel === "settings" ? <SettingsSheet /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AtlasSheet({ engineRef }: { engineRef: EngineRef }) {
  const catalog = useCatalog();
  const search = useSkyStore((s) => s.search);
  const setSearch = useSkyStore((s) => s.setSearch);
  const tab = useSkyStore((s) => s.atlasTab);
  const setTab = useSkyStore((s) => s.setAtlasTab);
  const mode = useSkyStore((s) => s.mode);
  const lat = useSkyStore((s) => s.lat);
  const lon = useSkyStore((s) => s.lon);
  const timeOffsetHours = useSkyStore((s) => s.timeOffsetHours);
  const setPanel = useSkyStore((s) => s.setPanel);

  const q = search.trim();
  const opts = { lat, lon, timeOffsetHours };

  const tonight = useMemo(
    () => (catalog ? pickTonight(catalog, { mode, ...opts }) : undefined),
    [catalog, mode, lat, lon, timeOffsetHours],
  );

  const up = useMemo(() => {
    if (!catalog) return [];
    if (mode === "outdoor") return upNow(catalog, { ...opts, limit: 10 });
    return featuredIndoor(catalog);
  }, [catalog, mode, lat, lon, timeOffsetHours]);

  const seasons = useMemo(
    () => (catalog ? groupBySeason(catalog.constellations) : []),
    [catalog],
  );

  const brights = catalog ? brightNamedStars(catalog.stars, 16) : [];
  const wanderers = useMemo(() => {
    const date = new Date(Date.now() + timeOffsetHours * 3_600_000);
    return solarSystem(date);
  }, [timeOffsetHours]);

  const conResults = catalog && q ? searchConstellations(catalog.constellations, q) : [];
  const starResults = catalog && q ? searchStars(catalog.stars, q) : [];
  const bodyResults = q ? searchBodies(wanderers, q) : [];
  const dsoResults = q ? searchDeepSky(q) : [];

  function openCon(id: string) {
    setPanel(null);
    engineRef.current?.selectConstellation(id);
  }
  function openStar(hip: number) {
    setPanel(null);
    engineRef.current?.selectStarByHip(hip);
  }
  function openBody(id: string) {
    setPanel(null);
    engineRef.current?.selectBody(id);
  }
  function openDso(id: string) {
    setPanel(null);
    engineRef.current?.selectDso(id);
  }

  if (!catalog) {
    return <p className="py-8 text-sm text-muted shimmer">Opening the atlas</p>;
  }

  return (
    <div className="pb-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search figures, stars, planets"
        aria-label="Search the atlas"
      />

      {q ? (
        <>
          <Section title="Figures">
            {conResults.length === 0 ? (
              <p className="py-4 text-sm text-muted">No figures match.</p>
            ) : (
              conResults.map((c) => (
                <ConRow
                  key={`${c.id}-${c.name}`}
                  con={c}
                  alt={mode === "outdoor" ? constellationAlt(c, opts) : undefined}
                  onSelect={() => openCon(c.id)}
                />
              ))
            )}
          </Section>
          <Section title="Stars">
            {starResults.length === 0 ? (
              <p className="py-4 text-sm text-muted">No named stars match.</p>
            ) : (
              starResults.map((star) => (
                <StarRow key={star.hip} star={star} onSelect={() => openStar(star.hip)} />
              ))
            )}
          </Section>
          {bodyResults.length > 0 ? (
            <Section title="Wanderers">
              {bodyResults.map((b) => (
                <BodyRow
                  key={b.id}
                  name={b.name}
                  detail={b.info}
                  onSelect={() => openBody(b.id)}
                />
              ))}
            </Section>
          ) : null}
          {dsoResults.length > 0 ? (
            <Section title="Deep sky">
              {dsoResults.map((d) => (
                <BodyRow
                  key={d.id}
                  name={d.name}
                  detail={`${d.id} · ${d.kind}`}
                  onSelect={() => openDso(d.id)}
                />
              ))}
            </Section>
          ) : null}
        </>
      ) : (
        <>
          {tonight ? (
            <TonightCard
              con={tonight}
              outdoor={mode === "outdoor"}
              alt={mode === "outdoor" ? constellationAlt(tonight, opts) : undefined}
              onGather={() => openCon(tonight.id)}
            />
          ) : null}

          <div className="sky-seg mt-4" role="tablist" aria-label="Atlas sections">
            {(
              [
                { id: "up" as AtlasTab, label: mode === "outdoor" ? "Up now" : "Start here" },
                { id: "figures" as AtlasTab, label: "Figures" },
                { id: "stars" as AtlasTab, label: "Stars" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={cn("sky-seg-item", tab === item.id && "is-on")}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "up" ? (
            <Section title={mode === "outdoor" ? "On this sky" : "Figures to start with"}>
              {up.map((c) => (
                <ConRow
                  key={`${c.id}-${c.name}`}
                  con={c}
                  alt={mode === "outdoor" ? constellationAlt(c, opts) : undefined}
                  onSelect={() => openCon(c.id)}
                />
              ))}
            </Section>
          ) : null}

          {tab === "figures" ? (
            seasons.map((group) => (
              <Section key={group.season} title={group.season}>
                {group.items.map((c) => (
                  <ConRow
                    key={`${c.id}-${c.name}`}
                    con={c}
                    alt={mode === "outdoor" ? constellationAlt(c, opts) : undefined}
                    onSelect={() => openCon(c.id)}
                  />
                ))}
              </Section>
            ))
          ) : null}

          {tab === "stars" ? (
            <>
              <Section title="Wanderers of this night">
                {wanderers
                  .filter((b) => b.id !== "sun")
                  .slice(0, 6)
                  .map((b) => (
                    <BodyRow
                      key={b.id}
                      name={b.name}
                      detail={b.info}
                      onSelect={() => openBody(b.id)}
                    />
                  ))}
              </Section>
              <Section title="Deep sky">
                {DEEP_SKY.slice(0, 6).map((d) => (
                  <BodyRow
                    key={d.id}
                    name={d.name}
                    detail={`${d.id} · ${d.kind}`}
                    onSelect={() => openDso(d.id)}
                  />
                ))}
              </Section>
              <Section title="Brightest stars">
                {brights.map((star) => (
                  <StarRow key={star.hip} star={star} onSelect={() => openStar(star.hip)} />
                ))}
              </Section>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function TonightCard({
  con,
  outdoor,
  alt,
  onGather,
}: {
  con: Constellation;
  outdoor: boolean;
  alt?: number;
  onGather: () => void;
}) {
  return (
    <div className="sky-tonight mt-4">
      <ConstellationGlyph con={con} className="size-16 shrink-0 text-fg" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-widest text-subtle uppercase">
          {outdoor ? "Tonight’s figure" : "A figure to start"}
        </p>
        <p className="font-display text-xl leading-tight tracking-tight">{con.name}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
          {constellationBlurb(con.id, con.en)}
        </p>
        {alt != null ? (
          <p className="mt-1 text-xs tabular-nums text-subtle">{formatAlt(alt)} up</p>
        ) : null}
      </div>
      <Button size="sm" onClick={onGather}>
        Gather
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-xs font-medium tracking-widest text-subtle uppercase">{title}</h3>
      <div className="mt-1 divide-y divide-border">{children}</div>
    </section>
  );
}

function ConRow({
  con,
  alt,
  onSelect,
}: {
  con: Constellation;
  alt?: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="flex h-14 w-full items-center gap-3 text-left"
      onClick={onSelect}
    >
      <ConstellationGlyph con={con} className="size-10 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{con.name}</span>
        <span className="block truncate text-xs text-muted">{con.gen}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-xs tracking-widest text-subtle uppercase">{con.id}</span>
        {alt != null ? (
          <span className="block text-xs tabular-nums text-muted">{formatAlt(alt)}</span>
        ) : null}
      </span>
    </button>
  );
}

function StarRow({ star, onSelect }: { star: Star; onSelect: () => void }) {
  return (
    <button
      type="button"
      className="flex h-12 w-full items-center justify-between gap-3 text-left"
      onClick={onSelect}
    >
      <span>
        <span className="block text-sm">{star.name}</span>
        <span className="text-xs text-muted">
          {star.con ?? "—"} · {spectralFromBv(star.bv)} · mag {star.mag.toFixed(2)}
        </span>
      </span>
      <span className="text-xs tabular-nums text-subtle">{formatRA(star.ra)}</span>
    </button>
  );
}

function BodyRow({
  name,
  detail,
  onSelect,
}: {
  name: string;
  detail: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="flex h-12 w-full items-center justify-between gap-3 text-left"
      onClick={onSelect}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm">{name}</span>
        <span className="block truncate text-xs text-muted">{detail}</span>
      </span>
    </button>
  );
}

function PlaceSheet({ engineRef }: { engineRef: EngineRef }) {
  const mode = useSkyStore((s) => s.mode);
  const setMode = useSkyStore((s) => s.setMode);
  const locationLabel = useSkyStore((s) => s.locationLabel);
  const lat = useSkyStore((s) => s.lat);
  const lon = useSkyStore((s) => s.lon);
  const setLocation = useSkyStore((s) => s.setLocation);
  const headingOffsetDeg = useSkyStore((s) => s.headingOffsetDeg);
  const setHeadingOffset = useSkyStore((s) => s.setHeadingOffset);
  const followDevice = useSkyStore((s) => s.followDevice);
  const motion = useSkyStore((s) => s.motion);
  const [gpsError, setGpsError] = useState<string | null>(null);

  function useGps() {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("This browser cannot share a location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(pos.coords.latitude, pos.coords.longitude, "This device", "gps");
        setMode("outdoor");
      },
      () => setGpsError("Location permission was declined."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="pb-4">
      <p className="text-sm leading-relaxed text-muted">
        Outdoor places the real sky for a latitude, longitude, and hour — cut at
        the horizon. Indoor is the whole vault, turned onto the room.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ModeCard
          title="Outdoor"
          body="Aligned to Earth"
          active={mode === "outdoor"}
          onClick={() => setMode("outdoor")}
        />
        <ModeCard
          title="Indoor"
          body="A private sphere"
          active={mode === "indoor"}
          onClick={() => setMode("indoor")}
        />
      </div>

      {motion !== "unavailable" ? (
        <div className="mt-4">
          <ToggleRow
            label="Follow this phone"
            on={followDevice}
            onToggle={() => void engineRef.current?.toggleFollow()}
          />
          <p className="text-xs leading-relaxed text-muted">
            Uses the compass and gyroscope so the vault matches how you hold the
            phone. Swipe to correct heading.
          </p>
          {motion === "denied" ? (
            <p className="mt-2 text-xs text-danger">
              Motion was declined. Enable it in the browser settings, then try again.
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "outdoor" ? (
        <>
          <p className="mt-5 font-display text-xl leading-none tracking-tight">
            {locationLabel}
          </p>
          <p className="mt-1 text-xs tabular-nums tracking-wide text-muted">
            {formatCoord(lat, lon)}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="secondary" onClick={useGps}>
              <MapPin className="size-4" />
              Use this device
            </Button>
          </div>
          {gpsError ? <p className="mt-2 text-xs text-danger">{gpsError}</p> : null}
          {CITY_GROUPS.map((group) => (
            <Section key={group.region} title={group.region}>
              <div className="grid grid-cols-2 gap-1 py-2 sm:grid-cols-3">
                {group.names.map((name) => {
                  const city = cityByName(name) ?? CITIES.find((c) => c.name === name);
                  if (!city) return null;
                  return (
                    <button
                      key={city.name}
                      type="button"
                      onClick={() => setLocation(city.lat, city.lon, city.name, "city")}
                      className={cn(
                        "h-11 rounded-md px-3 text-left text-sm",
                        city.name === locationLabel
                          ? "bg-accent text-accent-fg"
                          : "text-fg hover:bg-surface-2",
                      )}
                    >
                      {city.name}
                    </button>
                  );
                })}
              </div>
            </Section>
          ))}
        </>
      ) : (
        <p className="mt-5 text-sm leading-relaxed text-muted">
          Drag or hold the phone to look. Heading rotates the sphere onto a wall.
        </p>
      )}

      <div className="mt-5 flex items-center gap-4">
        <HeadingRose deg={headingOffsetDeg} onReset={() => setHeadingOffset(0)} />
        <label className="block min-w-0 flex-1">
          <span className="text-xs font-medium tracking-widest text-subtle uppercase">
            Heading {Math.round(headingOffsetDeg)}°
          </span>
          <input
            className="sky-range mt-1"
            type="range"
            min={-180}
            max={180}
            step={1}
            value={headingOffsetDeg}
            onChange={(e) => setHeadingOffset(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}

function HeadingRose({ deg, onReset }: { deg: number; onReset: () => void }) {
  return (
    <button
      type="button"
      className="sky-rose"
      onClick={onReset}
      aria-label="Reset heading to north"
    >
      <svg viewBox="0 0 100 100" className="size-full text-muted" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.28"
          strokeWidth="1.2"
        />
        <text x="50" y="16" textAnchor="middle" className="sky-rose-letter">
          N
        </text>
        <text x="50" y="94" textAnchor="middle" className="sky-rose-letter">
          S
        </text>
        <text x="10" y="54" textAnchor="middle" className="sky-rose-letter">
          W
        </text>
        <text x="90" y="54" textAnchor="middle" className="sky-rose-letter">
          E
        </text>
        <g transform={`rotate(${deg} 50 50)`}>
          <polygon points="50,18 54,50 50,48 46,50" className="fill-accent" />
          <polygon points="50,82 54,50 50,52 46,50" className="fill-subtle" />
        </g>
      </svg>
    </button>
  );
}

function ModeCard({
  title,
  body,
  active,
  onClick,
}: {
  title: string;
  body: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-3 text-left",
        active ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg",
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className={cn("mt-1 block text-xs", active ? "text-accent-fg/70" : "text-muted")}>
        {body}
      </span>
    </button>
  );
}

function NightSheet({ engineRef }: { engineRef: EngineRef }) {
  const catalog = useCatalog();
  const timeOffsetHours = useSkyStore((s) => s.timeOffsetHours);
  const setTimeOffset = useSkyStore((s) => s.setTimeOffset);
  const playing = useSkyStore((s) => s.playing);
  const setPlaying = useSkyStore((s) => s.setPlaying);
  const lat = useSkyStore((s) => s.lat);
  const lon = useSkyStore((s) => s.lon);
  const mode = useSkyStore((s) => s.mode);
  const setPanel = useSkyStore((s) => s.setPanel);

  const when = useMemo(() => {
    const d = new Date(Date.now() + timeOffsetHours * 3_600_000);
    return d.toLocaleString(undefined, {
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [timeOffsetHours]);

  const lst = useMemo(() => {
    const d = new Date(Date.now() + timeOffsetHours * 3_600_000);
    return formatLst(lstHours(d, lon));
  }, [timeOffsetHours, lon]);

  const rows = useMemo(() => {
    if (!catalog || mode !== "outdoor") return [];
    return skyRows(catalog, { lat, lon, timeOffsetHours, limit: 8 });
  }, [catalog, mode, lat, lon, timeOffsetHours]);

  const hours = [18, 20, 22, 0, 2, 4, 6];

  return (
    <div className="pb-4">
      <p className="font-display text-3xl leading-none tracking-tight tabular-nums">{when}</p>
      <p className="mt-2 text-sm text-muted">
        The vault turns with the hour. Sidereal {lst}. Play walks a whole night in a
        minute.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="chip"
          variant={Math.abs(timeOffsetHours) < 0.05 ? "default" : "outline"}
          onClick={() => {
            setPlaying(false);
            setTimeOffset(0);
          }}
        >
          Now
        </Button>
        <Button
          size="chip"
          variant="outline"
          onClick={() => {
            setPlaying(false);
            setTimeOffset(offsetToLocalHour(22));
          }}
        >
          Tonight
        </Button>
        <Button
          size="chip"
          variant="outline"
          onClick={() => {
            setPlaying(false);
            setTimeOffset(offsetToLocalHour(0));
          }}
        >
          Midnight
        </Button>
        <Button size="chip" variant={playing ? "default" : "outline"} onClick={() => setPlaying(!playing)}>
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {playing ? "Pause" : "Play the night"}
        </Button>
      </div>

      <div className="sky-clock mt-5" role="group" aria-label="Hour of night">
        {hours.map((h) => (
          <button
            key={h}
            type="button"
            className="sky-clock-hour"
            onClick={() => {
              setPlaying(false);
              setTimeOffset(offsetToLocalHour(h));
            }}
          >
            {h.toString().padStart(2, "0")}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-medium tracking-widest text-subtle uppercase">
          Offset {timeOffsetHours >= 0 ? "+" : ""}
          {timeOffsetHours.toFixed(1)} h
        </span>
        <input
          className="sky-range mt-1"
          type="range"
          min={-12}
          max={12}
          step={0.1}
          value={timeOffsetHours}
          onChange={(e) => setTimeOffset(Number(e.target.value))}
        />
      </label>

      {rows.length > 0 ? (
        <Section title="On this sky">
          {rows.map((row) => (
            <button
              key={`${row.con.id}-${row.con.name}`}
              type="button"
              className="flex h-12 w-full items-center justify-between gap-3 text-left"
              onClick={() => {
                setPanel(null);
                engineRef.current?.selectConstellation(row.con.id);
              }}
            >
              <span>
                <span className="block text-sm">{row.con.name}</span>
                <span className="text-xs text-muted">{motionLabel(row.motion)}</span>
              </span>
              <span className="text-xs tabular-nums text-subtle">{formatAlt(row.alt)}</span>
            </button>
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function SettingsSheet() {
  const magLimit = useSkyStore((s) => s.magLimit);
  const setMagLimit = useSkyStore((s) => s.setMagLimit);
  const showLines = useSkyStore((s) => s.showLines);
  const setShowLines = useSkyStore((s) => s.setShowLines);
  const showNames = useSkyStore((s) => s.showNames);
  const setShowNames = useSkyStore((s) => s.setShowNames);
  const showFigures = useSkyStore((s) => s.showFigures);
  const setShowFigures = useSkyStore((s) => s.setShowFigures);
  const showPlanets = useSkyStore((s) => s.showPlanets);
  const setShowPlanets = useSkyStore((s) => s.setShowPlanets);
  const setHeadingOffset = useSkyStore((s) => s.setHeadingOffset);

  const magNote = MAG_NOTES.reduce((best, n) => (magLimit >= n.mag ? n : best), MAG_NOTES[0]!);

  return (
    <div className="pb-4">
      <p className="text-sm leading-relaxed text-muted">
        How dense the chart is. Mythic drawings, names and stick lines can rest
        if you want only the points.
      </p>
      <label className="mt-5 block">
        <span className="text-xs font-medium tracking-widest text-subtle uppercase">
          Magnitude to {magLimit.toFixed(1)} · {magNote.label}
        </span>
        <input
          className="sky-range mt-1"
          type="range"
          min={1.5}
          max={6}
          step={0.1}
          value={magLimit}
          onChange={(e) => setMagLimit(Number(e.target.value))}
        />
      </label>
      <p className="mt-2 text-xs text-muted">{magNote.body}</p>
      <div className="mt-4 divide-y divide-border">
        <ToggleRow
          label="Mythic figures"
          on={showFigures}
          onToggle={() => setShowFigures(!showFigures)}
        />
        <ToggleRow
          label="Constellation lines"
          on={showLines}
          onToggle={() => setShowLines(!showLines)}
        />
        <ToggleRow
          label="Figure names"
          on={showNames}
          onToggle={() => setShowNames(!showNames)}
        />
        <ToggleRow
          label="Sun, moon & planets"
          on={showPlanets}
          onToggle={() => setShowPlanets(!showPlanets)}
        />
      </div>
      <Button variant="outline" className="mt-4 w-full" onClick={() => setHeadingOffset(0)}>
        Reset heading
      </Button>
      <p className="mt-5 text-xs leading-relaxed text-subtle">
        5,044 Hipparcos stars to magnitude 6 · 88 IAU figures · planets of this
        night. On a phone, pinch to zoom; Follow uses the compass.
      </p>
    </div>
  );
}

function ToggleRow({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-14 w-full items-center justify-between text-left"
      aria-pressed={on}
    >
      <span className="text-sm">{label}</span>
      <span
        className={cn(
          "relative h-6 w-10 rounded-full transition-colors duration-fast",
          on ? "bg-accent" : "bg-surface-2",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-bg transition-transform duration-fast",
            on ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
