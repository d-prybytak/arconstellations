# Architecture

Zenith is a single-page planetarium. The browser (or a WebXR session) is the
headset. There is no game loop with a walking character, no accounts, and no
server-side sky.

## Runtime

```
SkyApp                    canvas + label layer + overlay
  └─ SkyEngine            Three.js scene, XR, picking, follow
       ├─ skyGroup        stars, IAU lines, figures, planets, DSOs, dome
       ├─ presentGroup    Gather medallion (camera-local)
       └─ HUD (React)     intro, compass, Atlas / Place / Night / Chart
```

`src/components/sky-app.tsx` loads the engine module and `sky.json` in
parallel, then mounts `SkyEngine` on a canvas. React never owns the scene
graph.

## Coordinates

Stars are stored as equatorial RA/Dec (degrees) plus Hipparcos magnitude and
B−V.

- **Outdoor.** `astro.ts` turns RA/Dec into alt-az using GMST → LST at the
  viewer’s longitude, then latitude. The dome is cropped at the horizon.
  Ground and a dark landscape sit below alt = 0.
- **Indoor.** The same equatorial positions are drawn on a full sphere. A
  heading offset (`headingOffsetDeg`) yaws the vault so a wall can match a
  real azimuth.
- **Phone follow.** `device.ts` + `SkyEngine.enableFollow` apply a Tait-Bryan
  device-orientation quaternion (YXZ × −π/2 X × screen angle) to the camera.
  iOS must call `DeviceOrientationEvent.requestPermission`. Android prefers
  `deviceorientationabsolute` / `webkitCompassHeading`.

Look-at (`lookAtWorld`, `lookAzimuth`) and `enterXR` disable follow so a
chosen figure is not immediately yanked away by the gyro.

## Catalogue

`public/data/sky.json` is a packed extract:

```
stars: [hip, ra, dec, mag, bv][]
names: { [hip]: [proper, con, bayer] }
constellations: [{ id, name, gen, en, rank, ra, dec, paths }]
```

5,044 stars, magnitude ≤ 6. 89 constellation records: the 88 IAU figures,
with Serpens split into Caput and Cauda under the shared id `Ser`.

Do not fetch this JSON on the server during SSR. `loadSkyCatalog` is
browser-side and cached.

## Gather (inspect)

Picking a constellation:

1. Dims the vault.
2. Builds a camera-facing medallion (nodes + paths + halo + plate) in
   `presentGroup`.
3. Lerps it to ~2.15 m in front of the camera, slightly above the plaque.
4. React mounts `sky-inspect.tsx` as a museum card.

Picking a star or planet fills the same plaque without a medallion.

## State

Zustand store, `STORAGE_KEY = "zenith-sky-v2"`.

Persisted: `mode`, `lat`, `lon`, `locationLabel`, `magLimit`, layer toggles.

Never persisted: `introOpen`, `followDevice`, `panel`, `selected`, `xrActive`.

## HUD

Chrome recedes while the pointer is dragging. Sheets are a single panel
(`atlas` | `place` | `night` | `settings`) translated off-screen when closed
— they must not peek. Intro copy splits on `pointer: coarse` vs `pointer:
fine` so hydration stays honest (a desktop DevTools phone frame is not a
phone).

## WebXR

Preferred session: `immersive-ar` with `local-floor`. Optional `hand-tracking`
and `dom-overlay`. Desktop without XR is a first-class planetarium, not a
disabled state.

## What not to add casually

- React Three Fiber, Cannon, a character controller
- Auth, ads, or a star paywall
- Gold / purple / emoji in the HUD
- A second catalogue format next to `sky.json` without a loader plan
