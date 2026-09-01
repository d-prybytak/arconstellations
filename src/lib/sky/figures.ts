import { equatorialToCartesian } from "./astro";
import type { Constellation } from "./types";

export type FigureArt = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  right: [number, number, number];
  up: [number, number, number];
  center: [number, number, number];
};

type Pt = { x: number; y: number };

function basisOf(con: Constellation) {
  const raw: { x: number; y: number; z: number }[] = [];
  const pairs: [number, number][] = [];
  for (const path of con.paths) {
    const start = raw.length;
    for (const [ra, dec] of path) raw.push(equatorialToCartesian(ra, dec, 1));
    for (let i = 0; i < path.length - 1; i++) pairs.push([start + i, start + i + 1]);
  }
  if (raw.length === 0) {
    const c = equatorialToCartesian(con.ra, con.dec, 1);
    return {
      raw,
      pairs,
      pts: [] as Pt[],
      cx: c.x,
      cy: c.y,
      cz: c.z,
      rx: 1,
      ry: 0,
      rz: 0,
      ux: 0,
      uy: 1,
      uz: 0,
    };
  }
  const cx = raw.reduce((s, p) => s + p.x, 0) / raw.length;
  const cy = raw.reduce((s, p) => s + p.y, 0) / raw.length;
  const cz = raw.reduce((s, p) => s + p.z, 0) / raw.length;
  const fl = Math.hypot(cx, cy, cz) || 1;
  const fx = cx / fl;
  const fy = cy / fl;
  const fz = cz / fl;
  let ux = 0;
  let uy = 1;
  let uz = 0;
  let rx = uy * fz - uz * fy;
  let ry = uz * fx - ux * fz;
  let rz = ux * fy - uy * fx;
  let rl = Math.hypot(rx, ry, rz);
  if (rl < 1e-6) {
    ux = 1;
    uy = 0;
    uz = 0;
    rx = uy * fz - uz * fy;
    ry = uz * fx - ux * fz;
    rz = ux * fy - uy * fx;
    rl = Math.hypot(rx, ry, rz) || 1;
  }
  rx /= rl;
  ry /= rl;
  rz /= rl;
  ux = fy * rz - fz * ry;
  uy = fz * rx - fx * rz;
  uz = fx * ry - fy * rx;
  const pts = raw.map((p) => ({
    x: (p.x - cx) * rx + (p.y - cy) * ry + (p.z - cz) * rz,
    y: (p.x - cx) * ux + (p.y - cy) * uy + (p.z - cz) * uz,
  }));
  return { raw, pairs, pts, cx, cy, cz, rx, ry, rz, ux, uy, uz };
}

function convexHull(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts.slice();
  const sorted = pts
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.x - b.p.x || a.p.y - b.p.y);
  const lower: Pt[] = [];
  const upper: Pt[] = [];
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  for (const { p } of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!.p;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function offsetHull(hull: Pt[], amt: number): Pt[] {
  const n = hull.length;
  if (n < 3) return hull;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = hull[(i - 1 + n) % n]!;
    const b = hull[i]!;
    const c = hull[(i + 1) % n]!;
    const n1x = -(b.y - a.y);
    const n1y = b.x - a.x;
    const n2x = -(c.y - b.y);
    const n2y = c.x - b.x;
    const l1 = Math.hypot(n1x, n1y) || 1;
    const l2 = Math.hypot(n2x, n2y) || 1;
    let nx = n1x / l1 + n2x / l2;
    let ny = n1y / l1 + n2y / l2;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    out.push({ x: b.x + nx * amt, y: b.y + ny * amt });
  }
  return out;
}

function tapered(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  w1: number,
  w2: number,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(a.x + nx * w1, a.y + ny * w1);
  ctx.lineTo(b.x + nx * w2, b.y + ny * w2);
  ctx.lineTo(b.x - nx * w2, b.y - ny * w2);
  ctx.lineTo(a.x - nx * w1, a.y - ny * w1);
  ctx.closePath();
  ctx.fill();
}

export function paintFigure(con: Constellation): FigureArt | null {
  const b = basisOf(con);
  if (b.pts.length < 2) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of b.pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = Math.max(maxX - minX, maxY - minY) * 0.28 + 0.04;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const worldW = maxX - minX;
  const worldH = maxY - minY;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const sx = size / worldW;
  const sy = size / worldH;
  const s = Math.min(sx, sy);
  const ox = (size - worldW * s) / 2;
  const oy = (size - worldH * s) / 2;
  const map = (p: Pt): Pt => ({
    x: ox + (p.x - minX) * s,
    y: size - (oy + (p.y - minY) * s),
  });
  const dots = b.pts.map(map);
  const hull = convexHull(b.pts);
  const body = offsetHull(hull, pad * 0.35).map(map);
  const wash = offsetHull(hull, pad * 0.55).map(map);

  if (wash.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(wash[0]!.x, wash[0]!.y);
    for (let i = 1; i < wash.length; i++) ctx.lineTo(wash[i]!.x, wash[i]!.y);
    ctx.closePath();
    const cx = size / 2;
    const cy = size / 2;
    const grd = ctx.createRadialGradient(cx, cy, size * 0.08, cx, cy, size * 0.52);
    grd.addColorStop(0, "rgba(232, 220, 196, 0.11)");
    grd.addColorStop(0.55, "rgba(210, 198, 172, 0.045)");
    grd.addColorStop(1, "rgba(210, 198, 172, 0)");
    ctx.fillStyle = grd;
    ctx.fill();
  }

  if (body.length >= 3) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(body[0]!.x, body[0]!.y);
    for (let i = 1; i < body.length; i++) ctx.lineTo(body[i]!.x, body[i]!.y);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = "rgba(214, 202, 176, 0.09)";
    ctx.lineWidth = 1;
    for (let i = -size; i < size * 2; i += 9) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.fillStyle = "rgba(236, 226, 204, 0.26)";
  for (const [ia, ib] of b.pairs) {
    const a = dots[ia]!;
    const bpt = dots[ib]!;
    const len = Math.hypot(bpt.x - a.x, bpt.y - a.y);
    const w = Math.max(3.2, Math.min(9.5, 7.4 * (size / 512) * (40 / (len + 24))));
    tapered(ctx, a, bpt, w, w * 0.72);
  }

  ctx.strokeStyle = "rgba(244, 236, 218, 0.55)";
  ctx.lineWidth = 1.35 * (size / 512);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const [ia, ib] of b.pairs) {
    const a = dots[ia]!;
    const bpt = dots[ib]!;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(bpt.x, bpt.y);
  }
  ctx.stroke();

  for (const d of dots) {
    const glow = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, 16);
    glow.addColorStop(0, "rgba(255, 248, 230, 0.55)");
    glow.addColorStop(1, "rgba(255, 248, 230, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 250, 236, 0.92)";
    ctx.beginPath();
    ctx.arc(d.x, d.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const deg1 = new Map<number, number>();
  for (const [ia, ib] of b.pairs) {
    deg1.set(ia, (deg1.get(ia) ?? 0) + 1);
    deg1.set(ib, (deg1.get(ib) ?? 0) + 1);
  }
  ctx.strokeStyle = "rgba(232, 220, 196, 0.28)";
  ctx.lineWidth = 1.1;
  for (const [idx, deg] of deg1) {
    if (deg !== 1) continue;
    const d = dots[idx]!;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 11, Math.PI * 0.15, Math.PI * 1.35);
    ctx.stroke();
  }

  const fl = Math.hypot(b.cx, b.cy, b.cz) || 1;
  return {
    canvas,
    width: worldW,
    height: worldH,
    right: [b.rx, b.ry, b.rz],
    up: [b.ux, b.uy, b.uz],
    center: [b.cx / fl, b.cy / fl, b.cz / fl],
  };
}

const cache = new Map<string, FigureArt | null>();

export function figureFor(con: Constellation): FigureArt | null {
  const key = con.id + con.name;
  if (cache.has(key)) return cache.get(key)!;
  const art = paintFigure(con);
  cache.set(key, art);
  return art;
}
