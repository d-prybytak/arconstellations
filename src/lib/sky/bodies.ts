import { clamp, julianDate } from "./astro";

export type SolarBodyId =
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

export type SolarBody = {
  id: SolarBodyId;
  name: string;
  ra: number;
  dec: number;
  mag: number;
  color: [number, number, number];
  size: number;
  phase: number;
  waxing: boolean;
  info: string;
};

export type DeepSky = {
  id: string;
  name: string;
  ra: number;
  dec: number;
  kind: "galaxy" | "nebula" | "cluster";
  size: number;
  tint: [number, number, number];
  info: string;
};

const DEG = Math.PI / 180;
const OBL = 23.4393 * DEG;

function wrap360(n: number) {
  return ((n % 360) + 360) % 360;
}

function dJ2000(date: Date) {
  return julianDate(date) - 2_451_545.0;
}

function eclipticToEquatorial(lonDeg: number, latDeg: number) {
  const l = lonDeg * DEG;
  const b = latDeg * DEG;
  const cosB = Math.cos(b);
  const x = Math.cos(l) * cosB;
  const y = Math.sin(l) * cosB * Math.cos(OBL) - Math.sin(b) * Math.sin(OBL);
  const z = Math.sin(l) * cosB * Math.sin(OBL) + Math.sin(b) * Math.cos(OBL);
  const ra = Math.atan2(y, x);
  const dec = Math.atan2(z, Math.hypot(x, y));
  return { ra: wrap360((ra / DEG + 360) % 360), dec: dec / DEG };
}

function kepler(Mdeg: number, e: number) {
  let E = Mdeg * DEG;
  const M = ((Mdeg % 360) + 360) % 360;
  const Mr = ((M * DEG + Math.PI) % (2 * Math.PI)) - Math.PI;
  E = Mr;
  for (let i = 0; i < 8; i++) {
    E = E - (E - e * Math.sin(E) - Mr) / (1 - e * Math.cos(E));
  }
  return E;
}

type Elem = {
  id: SolarBodyId;
  name: string;
  a: number;
  e: number;
  i: number;
  L: number;
  wbar: number;
  Ω: number;
  da: number;
  de: number;
  di: number;
  dL: number;
  dw: number;
  dΩ: number;
  color: [number, number, number];
  size: number;
  mag: (r: number, Δ: number, fv: number) => number;
  info: string;
};

/** JPL Keplerian elements, T in centuries from J2000. Compact visual-grade. */
const PLANETS: Elem[] = [
  {
    id: "mercury",
    name: "Mercury",
    a: 0.38709927,
    e: 0.20563593,
    i: 7.00497902,
    L: 252.2503235,
    wbar: 77.45779628,
    Ω: 48.33076593,
    da: 0.00000037,
    de: 0.00001906,
    di: -0.00594749,
    dL: 149472.67411175,
    dw: 0.16047689,
    dΩ: -0.12534081,
    color: [0.72, 0.7, 0.66],
    size: 1.05,
    mag: (r, Δ) => -0.36 + 5 * Math.log10(r * Δ),
    info: "A small iron world, never far from the Sun.",
  },
  {
    id: "venus",
    name: "Venus",
    a: 0.72333566,
    e: 0.00677672,
    i: 3.39467605,
    L: 181.9790995,
    wbar: 131.60246718,
    Ω: 76.67984255,
    da: 0.0000039,
    de: -0.00004107,
    di: -0.0007889,
    dL: 58517.81538729,
    dw: 0.00268329,
    dΩ: -0.27769418,
    color: [0.95, 0.88, 0.7],
    size: 1.55,
    mag: (r, Δ) => -4.34 + 5 * Math.log10(r * Δ),
    info: "The evening or morning lantern. Clouded, bright.",
  },
  {
    id: "mars",
    name: "Mars",
    a: 1.52371034,
    e: 0.0933941,
    i: 1.84969142,
    L: -4.55343205,
    wbar: -23.94362959,
    Ω: 49.55953891,
    da: 0.00001847,
    de: 0.00007882,
    di: -0.00813131,
    dL: 19140.30268499,
    dw: 0.44441088,
    dΩ: -0.29257343,
    color: [0.92, 0.48, 0.32],
    size: 1.35,
    mag: (r, Δ) => -1.52 + 5 * Math.log10(r * Δ),
    info: "The red wanderer. Iron dust under a thin sky.",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    a: 5.202887,
    e: 0.04838624,
    i: 1.30439695,
    L: 34.39644051,
    wbar: 14.72847983,
    Ω: 100.47390909,
    da: -0.00011607,
    de: -0.00013253,
    di: -0.00183714,
    dL: 3034.74612775,
    dw: 0.21252668,
    dΩ: 0.20469106,
    color: [0.93, 0.82, 0.62],
    size: 2.15,
    mag: (r, Δ) => -9.25 + 5 * Math.log10(r * Δ),
    info: "A striped giant. Four moons sit in a line through a glass.",
  },
  {
    id: "saturn",
    name: "Saturn",
    a: 9.53667594,
    e: 0.05386179,
    i: 2.48599187,
    L: 49.95424423,
    wbar: 92.59887831,
    Ω: 113.66242448,
    da: -0.0012506,
    de: -0.00050991,
    di: 0.00193609,
    dL: 1222.49362201,
    dw: -0.41897216,
    dΩ: -0.28867794,
    color: [0.9, 0.82, 0.58],
    size: 1.95,
    mag: (r, Δ) => -8.88 + 5 * Math.log10(r * Δ),
    info: "The ringed one. A pale gold coin with ears.",
  },
  {
    id: "uranus",
    name: "Uranus",
    a: 19.18916464,
    e: 0.04725744,
    i: 0.77263783,
    L: 313.23218,
    wbar: 170.96424,
    Ω: 74.016925,
    da: -0.00196176,
    de: -0.00004397,
    di: -0.00242939,
    dL: 428.48202785,
    dw: 0.40805281,
    dΩ: 0.04240589,
    color: [0.62, 0.86, 0.88],
    size: 1.2,
    mag: (r, Δ) => -7.19 + 5 * Math.log10(r * Δ),
    info: "A green ice giant, just at the edge of unaided sight.",
  },
  {
    id: "neptune",
    name: "Neptune",
    a: 30.06992276,
    e: 0.00859048,
    i: 1.77004347,
    L: 304.88003,
    wbar: 44.97135,
    Ω: 131.784,
    da: 0.00026291,
    de: 0.00005105,
    di: 0.00035372,
    dL: 218.45945325,
    dw: -0.32241464,
    dΩ: -0.00508664,
    color: [0.42, 0.58, 0.92],
    size: 1.15,
    mag: (r, Δ) => -6.87 + 5 * Math.log10(r * Δ),
    info: "A distant blue. Wind on methane, too faint for the eye.",
  },
];

function helio(el: Elem, T: number) {
  const a = el.a + el.da * T;
  const e = el.e + el.de * T;
  const i = (el.i + el.di * T) * DEG;
  const L = wrap360(el.L + el.dL * T);
  const wbar = wrap360(el.wbar + el.dw * T);
  const Ω = wrap360(el.Ω + el.dΩ * T);
  const w = (wbar - Ω) * DEG;
  const M = wrap360(L - wbar);
  const E = kepler(M, e);
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.hypot(xv, yv);
  const cosO = Math.cos(Ω * DEG);
  const sinO = Math.sin(Ω * DEG);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);
  const cosVw = Math.cos(v + w);
  const sinVw = Math.sin(v + w);
  const xh = r * (cosO * cosVw - sinO * sinVw * cosI);
  const yh = r * (sinO * cosVw + cosO * sinVw * cosI);
  const zh = r * (sinVw * sinI);
  return { xh, yh, zh, r };
}

const EARTH: Elem = {
  id: "mars",
  name: "Earth",
  a: 1.00000261,
  e: 0.01671123,
  i: -0.00001531,
  L: 100.46457166,
  wbar: 102.93768193,
  Ω: 0,
  da: 0.00000562,
  de: -0.00004392,
  di: -0.01294668,
  dL: 35999.37244981,
  dw: 0.32327364,
  dΩ: 0,
  color: [0, 0, 0],
  size: 0,
  mag: () => 0,
  info: "",
};

function phaseName(illum: number, waxing: boolean) {
  if (illum < 0.04) return "New";
  if (illum < 0.35) return waxing ? "Waxing crescent" : "Waning crescent";
  if (illum < 0.65) return waxing ? "First quarter" : "Last quarter";
  if (illum < 0.96) return waxing ? "Waxing gibbous" : "Waning gibbous";
  return "Full";
}

function sunAndMoon(date: Date) {
  const d = dJ2000(date);
  const g = wrap360(357.529 + 0.98560028 * d) * DEG;
  const q = wrap360(280.459 + 0.98564736 * d);
  const L = wrap360(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  const sun = eclipticToEquatorial(L, 0);

  const N = wrap360(125.1228 - 0.0529538083 * d) * DEG;
  const i = 5.1454 * DEG;
  const w = wrap360(318.0634 + 0.1643573223 * d) * DEG;
  const a = 60.2666;
  const e = 0.0549;
  const M = wrap360(115.3654 + 13.0649929509 * d);
  const E = kepler(M, e);
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.hypot(xv, yv);
  const xh = r * (Math.cos(N) * Math.cos(v + w) - Math.sin(N) * Math.sin(v + w) * Math.cos(i));
  const yh = r * (Math.sin(N) * Math.cos(v + w) + Math.cos(N) * Math.sin(v + w) * Math.cos(i));
  const zh = r * (Math.sin(v + w) * Math.sin(i));
  const lon = wrap360(Math.atan2(yh, xh) / DEG);
  const lat = Math.atan2(zh, Math.hypot(xh, yh)) / DEG;
  const moon = eclipticToEquatorial(lon, lat);

  const sl = L * DEG;
  const ml = lon * DEG;
  const phaseAng = Math.acos(clamp(Math.cos(sl - ml), -1, 1));
  const illum = (1 - Math.cos(phaseAng)) / 2;
  const waxing = wrap360(lon - L) < 180;
  return { sun, L, moon, illum, waxing, phaseAng };
}

export function solarSystem(date: Date): SolarBody[] {
  const T = dJ2000(date) / 36525;
  const { sun, moon, illum, waxing } = sunAndMoon(date);
  const earth = helio(EARTH, T);

  const bodies: SolarBody[] = [
    {
      id: "sun",
      name: "Sun",
      ra: sun.ra,
      dec: sun.dec,
      mag: -26.7,
      color: [1, 0.92, 0.72],
      size: 6.4,
      phase: 1,
      waxing: true,
      info: "Our star. A G2 lantern two hundred and twenty thousand times the Moon.",
    },
    {
      id: "moon",
      name: "Moon",
      ra: moon.ra,
      dec: moon.dec,
      mag: -12.7 + 2.5 * (1 - illum) * 2,
      color: [0.92, 0.9, 0.84],
      size: 5.6,
      phase: illum,
      waxing,
      info: `${phaseName(illum, waxing)} · ${Math.round(illum * 100)}% lit. A cold stone at our elbow.`,
    },
  ];

  for (const el of PLANETS) {
    const p = helio(el, T);
    const xg = p.xh - earth.xh;
    const yg = p.yh - earth.yh;
    const zg = p.zh - earth.zh;
    const Δ = Math.hypot(xg, yg, zg);
    const lon = wrap360(Math.atan2(yg, xg) / DEG);
    const lat = Math.atan2(zg, Math.hypot(xg, yg)) / DEG;
    const eq = eclipticToEquatorial(lon, lat);
    const fv = Math.acos(clamp((p.r * p.r + Δ * Δ - 1) / (2 * p.r * Δ + 1e-9), -1, 1));
    bodies.push({
      id: el.id,
      name: el.name,
      ra: eq.ra,
      dec: eq.dec,
      mag: el.mag(p.r, Δ, fv),
      color: el.color,
      size: el.size,
      phase: 1,
      waxing: true,
      info: el.info,
    });
  }
  return bodies;
}

export const DEEP_SKY: DeepSky[] = [
  {
    id: "M31",
    name: "Andromeda",
    ra: 10.68,
    dec: 41.27,
    kind: "galaxy",
    size: 14,
    tint: [0.72, 0.78, 0.92],
    info: "The nearest spiral. Two and a half million years of light.",
  },
  {
    id: "M42",
    name: "Orion Nebula",
    ra: 83.82,
    dec: -5.39,
    kind: "nebula",
    size: 8.5,
    tint: [0.7, 0.86, 0.78],
    info: "A nursery in the hunter’s sword. New suns still in their gas.",
  },
  {
    id: "M45",
    name: "Pleiades",
    ra: 56.75,
    dec: 24.12,
    kind: "cluster",
    size: 7.2,
    tint: [0.78, 0.84, 0.95],
    info: "Seven sisters. Blue dust around young hot stars.",
  },
  {
    id: "M13",
    name: "Hercules Cluster",
    ra: 250.42,
    dec: 36.46,
    kind: "cluster",
    size: 5.4,
    tint: [0.9, 0.86, 0.72],
    info: "A globe of a hundred thousand suns, on the hero’s hip.",
  },
  {
    id: "M8",
    name: "Lagoon",
    ra: 270.89,
    dec: -24.38,
    kind: "nebula",
    size: 7.8,
    tint: [0.86, 0.55, 0.62],
    info: "A rose in Sagittarius, poured toward the galactic heart.",
  },
  {
    id: "ωCen",
    name: "Omega Centauri",
    ra: 201.7,
    dec: -47.48,
    kind: "cluster",
    size: 8.8,
    tint: [0.92, 0.88, 0.74],
    info: "The richest globular. A southern swarm.",
  },
  {
    id: "LMC",
    name: "Large Magellanic Cloud",
    ra: 80.89,
    dec: -69.76,
    kind: "galaxy",
    size: 18,
    tint: [0.78, 0.7, 0.82],
    info: "A companion galaxy, torn and still making stars.",
  },
  {
    id: "M33",
    name: "Triangulum",
    ra: 23.46,
    dec: 30.66,
    kind: "galaxy",
    size: 9,
    tint: [0.7, 0.76, 0.9],
    info: "The third of the local spirals, a faint oval on a dark night.",
  },
];

export function searchBodies(bodies: SolarBody[], q: string): SolarBody[] {
  const n = q.trim().toLowerCase();
  if (!n) return [];
  return bodies.filter(
    (b) => b.name.toLowerCase().includes(n) || b.id.toLowerCase().includes(n),
  );
}

export function searchDeepSky(q: string): DeepSky[] {
  const n = q.trim().toLowerCase();
  if (!n) return [];
  return DEEP_SKY.filter(
    (d) =>
      d.name.toLowerCase().includes(n) ||
      d.id.toLowerCase().includes(n) ||
      d.kind.includes(n),
  );
}

export function paintMoonPhase(phase: number, waxing: boolean): HTMLCanvasElement {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.42;
  ctx.clearRect(0, 0, s, s);
  const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, "#f4f0e6");
  g.addColorStop(0.55, "#d9d2c4");
  g.addColorStop(1, "#8a8478");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(8, 10, 16, 0.88)";
  const k = clamp(phase, 0, 1);
  const dir = waxing ? 1 : -1;
  if (k < 0.5) {
    const w = r * (1 - 2 * k);
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.abs(w), r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    if (dir > 0) ctx.rect(0, 0, cx, s);
    else ctx.rect(cx, 0, cx, s);
    ctx.fill();
  } else {
    ctx.beginPath();
    if (dir > 0) ctx.rect(0, 0, cx, s);
    else ctx.rect(cx, 0, cx, s);
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    const w = r * (2 * k - 1);
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.abs(w), r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-atop";
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}

export function paintDeepSky(obj: DeepSky): HTMLCanvasElement {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  const [r, g, b] = obj.tint;
  const cx = s / 2;
  const cy = s / 2;
  if (obj.kind === "galaxy") {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.7);
    ctx.scale(1, 0.42);
    const grd = ctx.createRadialGradient(0, 0, 4, 0, 0, 110);
    grd.addColorStop(0, `rgba(${r * 255},${g * 255},${b * 255},0.55)`);
    grd.addColorStop(0.35, `rgba(${r * 255},${g * 255},${b * 255},0.18)`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (obj.kind === "nebula") {
    for (let i = 0; i < 14; i++) {
      const x = cx + (Math.sin(i * 1.7) * 36);
      const y = cy + (Math.cos(i * 1.3) * 28);
      const rad = 28 + (i % 5) * 10;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const a = 0.06 + (i % 3) * 0.03;
      grd.addColorStop(0, `rgba(${r * 255},${g * 255},${b * 255},${a})`);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  } else {
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
    grd.addColorStop(0, `rgba(${r * 255},${g * 255},${b * 255},0.5)`);
    grd.addColorStop(0.4, `rgba(${r * 255},${g * 255},${b * 255},0.12)`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${r * 255},${g * 255},${b * 255},0.55)`;
    for (let i = 0; i < 40; i++) {
      const ang = (i / 40) * Math.PI * 2;
      const rad = (i % 7) * 7;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.85, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}
