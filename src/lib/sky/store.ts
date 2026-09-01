import { create } from "zustand";
import type { SelectedObject, SkyMode, XrSupport } from "./types";
import { CITIES } from "./cities";

const london = CITIES[0]!;

export type HudPanel = "atlas" | "place" | "night" | "settings" | null;
export type AtlasTab = "up" | "figures" | "stars";
export type MotionStatus =
  | "unavailable"
  | "needs-permission"
  | "ready"
  | "live"
  | "denied";

type SkyState = {
  ready: boolean;
  error: string | null;
  mode: SkyMode;
  lat: number;
  lon: number;
  locationLabel: string;
  locationSource: "gps" | "city" | "default";
  timeOffsetHours: number;
  playing: boolean;
  magLimit: number;
  showLines: boolean;
  showNames: boolean;
  showFigures: boolean;
  showPlanets: boolean;
  headingOffsetDeg: number;
  selected: SelectedObject | null;
  hoveredName: string | null;
  xr: XrSupport;
  xrActive: boolean;
  introOpen: boolean;
  search: string;
  panel: HudPanel;
  atlasTab: AtlasTab;
  dragging: boolean;
  viewAz: number;
  hint: string | null;
  followDevice: boolean;
  motion: MotionStatus;
  setReady: (ready: boolean) => void;
  setError: (error: string | null) => void;
  setMode: (mode: SkyMode) => void;
  setLocation: (
    lat: number,
    lon: number,
    label: string,
    source: SkyState["locationSource"],
  ) => void;
  setTimeOffset: (hours: number) => void;
  setPlaying: (playing: boolean) => void;
  setMagLimit: (mag: number) => void;
  setShowLines: (show: boolean) => void;
  setShowNames: (show: boolean) => void;
  setShowFigures: (show: boolean) => void;
  setShowPlanets: (show: boolean) => void;
  setHeadingOffset: (deg: number) => void;
  nudgeHeading: (delta: number) => void;
  setSelected: (selected: SelectedObject | null) => void;
  setHoveredName: (name: string | null) => void;
  setXr: (xr: XrSupport) => void;
  setXrActive: (active: boolean) => void;
  setIntroOpen: (open: boolean) => void;
  setSearch: (search: string) => void;
  setPanel: (panel: HudPanel) => void;
  setAtlasTab: (tab: AtlasTab) => void;
  setDragging: (dragging: boolean) => void;
  setViewAz: (viewAz: number) => void;
  setHint: (hint: string | null) => void;
  setFollowDevice: (follow: boolean) => void;
  setMotion: (motion: MotionStatus) => void;
};

const STORAGE_KEY = "zenith-sky-v2";

function persist(partial: Partial<SkyState>) {
  try {
    const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<
      string,
      unknown
    >;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...prev,
        mode: partial.mode ?? prev.mode,
        lat: partial.lat ?? prev.lat,
        lon: partial.lon ?? prev.lon,
        locationLabel: partial.locationLabel ?? prev.locationLabel,
        magLimit: partial.magLimit ?? prev.magLimit,
        showLines: partial.showLines ?? prev.showLines,
        showNames: partial.showNames ?? prev.showNames,
        showFigures: partial.showFigures ?? prev.showFigures,
        showPlanets: partial.showPlanets ?? prev.showPlanets,
      }),
    );
  } catch {
    /* ignore */
  }
}

function loadPersisted(): Partial<SkyState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<SkyState>;
  } catch {
    return {};
  }
}

const persisted = typeof window !== "undefined" ? loadPersisted() : {};

export const useSkyStore = create<SkyState>((set, get) => ({
  ready: false,
  error: null,
  mode: persisted.mode ?? "indoor",
  lat: persisted.lat ?? london.lat,
  lon: persisted.lon ?? london.lon,
  locationLabel: persisted.locationLabel ?? london.name,
  locationSource: "default",
  timeOffsetHours: 0,
  playing: false,
  magLimit: persisted.magLimit ?? 5.2,
  showLines: persisted.showLines ?? true,
  showNames: persisted.showNames ?? true,
  showFigures: persisted.showFigures ?? true,
  showPlanets: persisted.showPlanets ?? true,
  headingOffsetDeg: 0,
  selected: null,
  hoveredName: null,
  xr: { ar: false, vr: false },
  xrActive: false,
  introOpen: true,
  search: "",
  panel: null,
  atlasTab: "up",
  dragging: false,
  viewAz: 0,
  hint: null,
  followDevice: false,
  motion: "unavailable",
  setReady: (ready) => set({ ready }),
  setError: (error) => set({ error }),
  setMode: (mode) => {
    persist({ mode });
    set({ mode });
  },
  setLocation: (lat, lon, label, source) => {
    persist({ lat, lon, locationLabel: label });
    set({ lat, lon, locationLabel: label, locationSource: source });
  },
  setTimeOffset: (hours) => set({ timeOffsetHours: hours }),
  setPlaying: (playing) => set({ playing }),
  setMagLimit: (magLimit) => {
    persist({ magLimit });
    set({ magLimit });
  },
  setShowLines: (showLines) => {
    persist({ showLines });
    set({ showLines });
  },
  setShowNames: (showNames) => {
    persist({ showNames });
    set({ showNames });
  },
  setShowFigures: (showFigures) => {
    persist({ showFigures });
    set({ showFigures });
  },
  setShowPlanets: (showPlanets) => {
    persist({ showPlanets });
    set({ showPlanets });
  },
  setHeadingOffset: (headingOffsetDeg) => set({ headingOffsetDeg }),
  nudgeHeading: (delta) => set({ headingOffsetDeg: get().headingOffsetDeg + delta }),
  setSelected: (selected) =>
    set({ selected, introOpen: false, panel: selected ? null : get().panel }),
  setHoveredName: (hoveredName) => set({ hoveredName }),
  setXr: (xr) => set({ xr }),
  setXrActive: (xrActive) => set({ xrActive }),
  setIntroOpen: (introOpen) => set({ introOpen }),
  setSearch: (search) => set({ search }),
  setPanel: (panel) => set({ panel, introOpen: false }),
  setAtlasTab: (atlasTab) => set({ atlasTab }),
  setDragging: (dragging) => set({ dragging }),
  setViewAz: (viewAz) => set({ viewAz }),
  setHint: (hint) => set({ hint }),
  setFollowDevice: (followDevice) => set({ followDevice }),
  setMotion: (motion) => set({ motion }),
}));
