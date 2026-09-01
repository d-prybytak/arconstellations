export type MotionCapability = "unavailable" | "needs-permission" | "ready";

export function isCoarsePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

export function motionCapability(): MotionCapability {
  if (typeof window === "undefined") return "unavailable";
  if (typeof DeviceOrientationEvent === "undefined") return "unavailable";
  const DOE = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  if (typeof DOE.requestPermission === "function") return "needs-permission";
  return "ready";
}

export async function requestMotionPermission(): Promise<boolean> {
  try {
    if (typeof DeviceOrientationEvent === "undefined") return false;
    const DOE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof DOE.requestPermission === "function") {
      const res = await DOE.requestPermission();
      return res === "granted";
    }
    return true;
  } catch {
    return false;
  }
}

export function screenAngleDeg() {
  if (typeof window === "undefined") return 0;
  const so = window.screen?.orientation?.angle;
  if (typeof so === "number" && !Number.isNaN(so)) return so;
  const legacy = (window as Window & { orientation?: number }).orientation;
  if (typeof legacy === "number") return legacy;
  return 0;
}

export function locateDevice(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  });
}
