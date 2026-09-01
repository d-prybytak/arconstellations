import { useMemo, useState, type RefObject } from "react";
import { BookOpen, Compass, Moon, Pause, Settings2, Smartphone, Telescope } from "lucide-react";
import { SkyCompass } from "@/components/sky-compass";
import { InspectPanel } from "@/components/sky-inspect";
import { Sheets } from "@/components/sky-sheets";
import { Button } from "@/components/ui/button";
import { pickTonight } from "@/lib/sky/catalog";
import { locateDevice } from "@/lib/sky/device";
import type { SkyEngine } from "@/lib/sky/engine";
import { useSkyStore, type HudPanel } from "@/lib/sky/store";
import { useCatalog } from "@/lib/sky/use-catalog";
import { cn } from "@/lib/utils";

type EngineRef = RefObject<SkyEngine | null>;

export function SkyHud({ engineRef }: { engineRef: EngineRef }) {
  const ready = useSkyStore((s) => s.ready);
  const error = useSkyStore((s) => s.error);
  const introOpen = useSkyStore((s) => s.introOpen);
  const dragging = useSkyStore((s) => s.dragging);
  const panel = useSkyStore((s) => s.panel);
  const selected = useSkyStore((s) => s.selected);
  const xrActive = useSkyStore((s) => s.xrActive);
  const hideChrome = dragging && !panel && !selected && !introOpen && !xrActive;
  const showChrome = ready && !introOpen;
  const showCompass = showChrome && !selected && !panel;

  return (
    <>
      {!ready && !error ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}

      {showChrome ? (
        <div
          className="sky-chrome sky-chrome-top pointer-events-none flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6"
          data-hidden={hideChrome ? "true" : "false"}
        >
          <div className="pointer-events-auto">
            <StatusMark />
          </div>
          <div className="pointer-events-auto flex items-start gap-2">
            <FollowButton engineRef={engineRef} />
            <XrButton engineRef={engineRef} />
          </div>
        </div>
      ) : null}

      {introOpen && ready && !xrActive ? <Intro engineRef={engineRef} /> : null}

      {showChrome && !selected && !panel && !introOpen ? (
        <div className="sky-reticle" data-quiet={hideChrome ? "true" : "false"} aria-hidden />
      ) : null}

      {showChrome ? (
        <div
          className="sky-chrome sky-chrome-bottom pointer-events-none mt-auto flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
          data-hidden={hideChrome ? "true" : "false"}
        >
          <HoverChip />
          <HintLine />
          {showCompass ? <SkyCompass engineRef={engineRef} /> : null}
          {selected ? <InspectPanel engineRef={engineRef} /> : <BottomNav />}
        </div>
      ) : (
        <div className="mt-auto" />
      )}

      <Sheets engineRef={engineRef} />
    </>
  );
}

function LoadingState() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <p className="font-display text-lg shimmer">Charting the sky</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center p-6">
      <p className="max-w-sm text-center text-sm text-danger">{message}</p>
    </div>
  );
}

function StatusMark() {
  const locationLabel = useSkyStore((s) => s.locationLabel);
  const mode = useSkyStore((s) => s.mode);
  const timeOffsetHours = useSkyStore((s) => s.timeOffsetHours);
  const setPanel = useSkyStore((s) => s.setPanel);
  const when = useMemo(() => {
    const d = new Date(Date.now() + timeOffsetHours * 3_600_000);
    return d.toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [timeOffsetHours]);

  return (
    <button
      type="button"
      onClick={() => setPanel("place")}
      className="sky-panel rounded-xl px-4 py-3 text-left transition-[box-shadow] duration-quick hover:shadow-[0_0_0_1px_rgb(232_234_238/0.16)]"
    >
      <p className="font-display text-xl leading-none tracking-tight sm:text-2xl">Zenith</p>
      <p className="mt-1 text-xs font-medium tracking-widest text-muted uppercase">
        {mode === "outdoor" ? locationLabel : "Indoor vault"} · {when}
      </p>
    </button>
  );
}

function FollowButton({ engineRef }: { engineRef: EngineRef }) {
  const followDevice = useSkyStore((s) => s.followDevice);
  const motion = useSkyStore((s) => s.motion);
  const xrActive = useSkyStore((s) => s.xrActive);
  const [busy, setBusy] = useState(false);
  if (xrActive) return null;
  if (motion === "unavailable" || motion === "denied") return null;

  async function toggle() {
    const engine = engineRef.current;
    if (!engine) return;
    setBusy(true);
    try {
      await engine.toggleFollow();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant={followDevice ? "default" : "outline"}
      className="sky-coarse-only"
      disabled={busy}
      onClick={() => void toggle()}
      aria-pressed={followDevice}
    >
      <Smartphone className="size-4" />
      {followDevice ? "Following" : "Follow"}
    </Button>
  );
}

function XrButton({ engineRef }: { engineRef: EngineRef }) {
  const xr = useSkyStore((s) => s.xr);
  const xrActive = useSkyStore((s) => s.xrActive);
  const [busy, setBusy] = useState(false);
  const supported = xr.ar || xr.vr;
  if (!supported && !xrActive) return null;

  async function toggle() {
    const engine = engineRef.current;
    if (!engine) return;
    setBusy(true);
    try {
      if (xrActive) await engine.exitXR();
      else await engine.enterXR();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" disabled={busy} onClick={() => void toggle()}>
      <Telescope className="size-4" />
      {xrActive ? "Exit AR" : "Enter AR"}
    </Button>
  );
}

function Intro({ engineRef }: { engineRef: EngineRef }) {
  const setIntroOpen = useSkyStore((s) => s.setIntroOpen);
  const setHint = useSkyStore((s) => s.setHint);
  const setMode = useSkyStore((s) => s.setMode);
  const setLocation = useSkyStore((s) => s.setLocation);
  const xr = useSkyStore((s) => s.xr);
  const mode = useSkyStore((s) => s.mode);
  const locationLabel = useSkyStore((s) => s.locationLabel);
  const timeOffsetHours = useSkyStore((s) => s.timeOffsetHours);
  const lat = useSkyStore((s) => s.lat);
  const lon = useSkyStore((s) => s.lon);
  const motion = useSkyStore((s) => s.motion);
  const catalog = useCatalog();
  const supported = xr.ar || xr.vr;
  const [holding, setHolding] = useState(false);

  const tonight = catalog
    ? pickTonight(catalog, { mode, lat, lon, timeOffsetHours })
    : undefined;

  const when = useMemo(() => {
    const d = new Date(Date.now() + timeOffsetHours * 3_600_000);
    return d.toLocaleString(undefined, {
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [timeOffsetHours]);

  function lookAround() {
    setIntroOpen(false);
    setHint("Tap a star, or open the atlas");
    window.setTimeout(() => {
      if (useSkyStore.getState().hint) useSkyStore.getState().setHint(null);
    }, 5200);
  }

  async function holdToSky() {
    setHolding(true);
    try {
      const engine = engineRef.current;
      const ok = engine ? await engine.enableFollow() : false;
      const geo = await locateDevice();
      if (geo) {
        setLocation(geo.lat, geo.lon, "This device", "gps");
        setMode("outdoor");
      }
      setIntroOpen(false);
      setHint(
        ok
          ? "Hold the phone up. Swipe to correct, pinch to zoom."
          : "Drag to look. Pinch with two fingers to zoom.",
      );
      window.setTimeout(() => {
        if (useSkyStore.getState().hint) useSkyStore.getState().setHint(null);
      }, 5600);
    } finally {
      setHolding(false);
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center px-5 sm:top-[28%] sm:px-6">
      <div className="stagger-in max-w-lg text-center">
        <p className="text-xs font-medium tracking-widest text-subtle uppercase">Zenith</p>
        <p className="mt-3 font-display text-4xl leading-none tracking-tight text-fg sm:text-6xl">
          The sky, on your face.
        </p>
        <p className="sky-copy-fine mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
          Drag to look. Figures are drawn over the stars. Tap one and it gathers
          out of the night to sit with you.
        </p>
        <p className="sky-copy-coarse mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
          Hold the phone up — the sky follows. Pinch to zoom. Tap a figure and it
          gathers out of the night to sit with you.
        </p>
        <p className="mt-3 text-xs font-medium tracking-widest text-subtle uppercase">
          {mode === "outdoor" ? locationLabel : "Indoor vault"} · {when}
        </p>
        <div className="sky-fine-only pointer-events-auto mt-6 flex-col items-center justify-center gap-2 sm:flex-row">
          <Button onClick={lookAround}>Look around</Button>
          <Button
            variant="outline"
            onClick={() => {
              lookAround();
              engineRef.current?.selectConstellation(tonight?.id ?? "Ori");
            }}
          >
            Gather {tonight?.name ?? "Orion"}
          </Button>
        </div>
        <div className="sky-coarse-only pointer-events-auto mt-6 flex-col items-center justify-center gap-2">
          {motion !== "unavailable" ? (
            <Button className="w-full max-w-xs" disabled={holding} onClick={() => void holdToSky()}>
              <Smartphone className="size-4" />
              {holding ? "Listening…" : "Hold to the sky"}
            </Button>
          ) : null}
          <Button
            variant={motion === "unavailable" ? "default" : "outline"}
            className="w-full max-w-xs"
            onClick={lookAround}
          >
            Drag to look
          </Button>
          <Button
            variant="outline"
            className="w-full max-w-xs"
            onClick={() => {
              lookAround();
              engineRef.current?.selectConstellation(tonight?.id ?? "Ori");
            }}
          >
            Gather {tonight?.name ?? "Orion"}
          </Button>
        </div>
        {supported ? (
          <p className="mt-4 text-xs tracking-wide text-subtle">
            On Galaxy XR, use Enter AR for passthrough.
          </p>
        ) : (
          <p className="sky-copy-coarse mt-4 text-xs tracking-wide text-subtle">
            Works on iPhone and Android. Add it to the home screen for a full-screen vault.
          </p>
        )}
      </div>
    </div>
  );
}

function HoverChip() {
  const hoveredName = useSkyStore((s) => s.hoveredName);
  const selected = useSkyStore((s) => s.selected);
  if (!hoveredName || selected) return null;
  return (
    <div className="pointer-events-none self-center rounded-full bg-surface px-3 py-1 text-xs font-medium tracking-wide text-fg shadow-[0_0_0_1px_rgb(232_234_238/0.08)]">
      {hoveredName}
    </div>
  );
}

function HintLine() {
  const hint = useSkyStore((s) => s.hint);
  const selected = useSkyStore((s) => s.selected);
  if (!hint || selected) return null;
  return (
    <p className="pointer-events-none self-center text-xs tracking-wide text-muted">
      {hint}
    </p>
  );
}

function BottomNav() {
  const panel = useSkyStore((s) => s.panel);
  const setPanel = useSkyStore((s) => s.setPanel);
  const playing = useSkyStore((s) => s.playing);

  const items: { id: HudPanel; label: string; icon: typeof BookOpen }[] = [
    { id: "atlas", label: "Atlas", icon: BookOpen },
    { id: "place", label: "Place", icon: Compass },
    { id: "night", label: playing ? "Playing" : "Night", icon: playing ? Pause : Moon },
    { id: "settings", label: "Chart", icon: Settings2 },
  ];

  return (
    <nav className="pointer-events-auto mx-auto flex w-full max-w-md rounded-xl bg-surface p-2 shadow-[0_0_0_1px_rgb(232_234_238/0.08)]">
      {items.map((item) => {
        const Icon = item.icon;
        const on = panel === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setPanel(on ? null : item.id)}
            className={cn(
              "flex h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-subtle transition-[color,background-color] duration-quick",
              on ? "bg-surface-2 text-fg" : "hover:text-fg",
            )}
          >
            <Icon className="size-4" />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
