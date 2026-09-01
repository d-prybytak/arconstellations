const DEG = Math.PI / 180;

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function julianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

/** Greenwich mean sidereal time in hours. */
export function gmstHours(date: Date): number {
  const jd = julianDate(date);
  const t = (jd - 2_451_545.0) / 36_525;
  let gmst =
    280.46061837 +
    360.98564736629 * (jd - 2_451_545.0) +
    0.000387933 * t * t -
    (t * t * t) / 38_710_000;
  gmst = ((gmst % 360) + 360) % 360;
  return gmst / 15;
}

export function lstHours(date: Date, lonDeg: number): number {
  return (gmstHours(date) + lonDeg / 15 + 24) % 24;
}

/** Altitude/azimuth in degrees. Azimuth: 0 = north, 90 = east. */
export function equatorialToAltAz(
  raDeg: number,
  decDeg: number,
  latDeg: number,
  lstH: number,
): { alt: number; az: number } {
  const ha = (lstH - raDeg / 15) * 15 * DEG;
  const dec = decDeg * DEG;
  const lat = latDeg * DEG;
  const sinAlt =
    Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(clamp(sinAlt, -1, 1));
  const cosAlt = Math.cos(alt);
  const sinAz = -(Math.cos(dec) * Math.sin(ha)) / (cosAlt || 1e-9);
  const cosAz =
    (Math.sin(dec) - Math.sin(lat) * sinAlt) / (Math.cos(lat) * (cosAlt || 1e-9));
  const az = Math.atan2(sinAz, cosAz);
  return { alt: alt / DEG, az: ((az / DEG) + 360) % 360 };
}

export function altAzToCartesian(
  altDeg: number,
  azDeg: number,
  radius: number,
): { x: number; y: number; z: number } {
  const alt = altDeg * DEG;
  const az = azDeg * DEG;
  const cAlt = Math.cos(alt);
  return {
    x: radius * cAlt * Math.sin(az),
    y: radius * Math.sin(alt),
    z: radius * -cAlt * Math.cos(az),
  };
}

/** Equatorial cartesian, Y = north celestial pole, -Z = RA 0h on the equator. */
export function equatorialToCartesian(
  raDeg: number,
  decDeg: number,
  radius: number,
): { x: number; y: number; z: number } {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  const cDec = Math.cos(dec);
  return {
    x: radius * cDec * Math.sin(ra),
    y: radius * Math.sin(dec),
    z: radius * -cDec * Math.cos(ra),
  };
}

export function formatRA(raDeg: number): string {
  const h = ((raDeg / 15) % 24 + 24) % 24;
  const hh = Math.floor(h);
  const m = (h - hh) * 60;
  const mm = Math.floor(m);
  return `${hh}h ${mm.toString().padStart(2, "0")}m`;
}

export function formatDec(decDeg: number): string {
  const sign = decDeg < 0 ? "−" : "+";
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  return `${sign}${d}° ${m.toString().padStart(2, "0")}′`;
}

export function cardinalFromAz(azDeg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const i = Math.round(((azDeg % 360) + 360) % 360 / 45) % 8;
  return dirs[i]!;
}

export function formatAz(azDeg: number): string {
  return `${Math.round(azDeg)}° ${cardinalFromAz(azDeg)}`;
}

export function formatLst(hours: number): string {
  const h = ((hours % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${hh.toString().padStart(2, "0")}h ${mm.toString().padStart(2, "0")}m`;
}

export function formatCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}  ${Math.abs(lon).toFixed(2)}° ${ew}`;
}

export function formatAlt(alt: number): string {
  const n = Math.round(alt);
  return `${n < 0 ? "−" : ""}${Math.abs(n)}°`;
}

export function isCircumpolar(decDeg: number, latDeg: number): boolean {
  return Math.abs(decDeg) > 90 - Math.abs(latDeg) && Math.sign(decDeg) === Math.sign(latDeg);
}

export function spectralFromBv(bv: number): string {
  if (bv < -0.3) return "O";
  if (bv < -0.05) return "B";
  if (bv < 0.3) return "A";
  if (bv < 0.58) return "F";
  if (bv < 0.81) return "G";
  if (bv < 1.4) return "K";
  return "M";
}

export function bvToRgb(bv: number): [number, number, number] {
  const t = clamp(bv, -0.4, 2.0);
  let r = 1;
  let g = 1;
  let b = 1;
  if (t < 0) {
    r = 0.72 + 0.28 * ((t + 0.4) / 0.4);
    g = 0.82 + 0.18 * ((t + 0.4) / 0.4);
    b = 1;
  } else if (t < 0.5) {
    r = 0.92 + 0.08 * (t / 0.5);
    g = 0.94 + 0.04 * (t / 0.5);
    b = 1 - 0.18 * (t / 0.5);
  } else if (t < 1.2) {
    const u = (t - 0.5) / 0.7;
    r = 1;
    g = 0.98 - 0.28 * u;
    b = 0.82 - 0.52 * u;
  } else {
    const u = (t - 1.2) / 0.8;
    r = 1;
    g = 0.7 - 0.22 * u;
    b = 0.3 - 0.12 * u;
  }
  return [r, g, b];
}

export type SkyMotion = "below" | "rising" | "up" | "overhead" | "setting";

export function skyMotion(alt: number, dAlt: number): SkyMotion {
  if (alt < -2) return "below";
  if (alt > 72) return "overhead";
  if (dAlt > 1.2) return "rising";
  if (dAlt < -1.2) return "setting";
  return "up";
}

export function motionLabel(m: SkyMotion): string {
  if (m === "below") return "below the horizon";
  if (m === "rising") return "rising";
  if (m === "setting") return "setting";
  if (m === "overhead") return "overhead";
  return "up";
}
