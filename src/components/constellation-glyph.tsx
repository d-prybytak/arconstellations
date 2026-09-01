import { useMemo } from "react";
import { equatorialToCartesian } from "@/lib/sky/astro";
import { cn } from "@/lib/utils";
import type { Constellation } from "@/lib/sky/types";

export function ConstellationGlyph({
  con,
  className,
}: {
  con: Constellation;
  className?: string;
}) {
  const { lines, dots } = useMemo(() => buildGlyph(con), [con]);

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("sky-glyph text-muted", className)}
      aria-hidden
    >
      {lines.length > 0 ? (
        <path d={lines.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.7" />
      ) : null}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r="2.6" fill="currentColor" />
      ))}
    </svg>
  );
}

function buildGlyph(con: Constellation) {
  const raw: { x: number; y: number; z: number }[] = [];
  const pairs: [number, number][] = [];
  for (const path of con.paths) {
    const start = raw.length;
    for (const [ra, dec] of path) {
      raw.push(equatorialToCartesian(ra, dec, 1));
    }
    for (let i = 0; i < path.length - 1; i++) {
      pairs.push([start + i, start + i + 1]);
    }
  }
  if (raw.length === 0) {
    return { lines: [] as string[], dots: [{ x: 50, y: 50 }] };
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
  let maxR = 0.001;
  for (const p of pts) maxR = Math.max(maxR, Math.hypot(p.x, p.y));
  const svgPts = pts.map((p) => ({
    x: 50 + (p.x / maxR) * 40,
    y: 50 - (p.y / maxR) * 40,
  }));
  const lines = pairs.map(([a, b]) => {
    const p = svgPts[a]!;
    const q = svgPts[b]!;
    return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  });
  const seen = new Set<string>();
  const dots: { x: number; y: number }[] = [];
  for (const p of svgPts) {
    const k = `${p.x.toFixed(0)}:${p.y.toFixed(0)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dots.push(p);
  }
  return { lines, dots };
}
