# Contributing to Zenith

Thank you for coming in from the dark.

Issues and pull requests in **English or Russian** are welcome. The code,
commit messages, and review comments stay in English so everyone can read
the history.

## Before you write code

1. Open an issue (or comment on one) so two people do not draw the same star.
2. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
3. Run the app and click through intro → explore → Atlas → Gather on Orion.

```bash
npm install
npm run dev
npm run typecheck
```

## Where things live

| You want to change… | Start here |
| --- | --- |
| Star positions, alt-az, time | `src/lib/sky/astro.ts` |
| Packed catalogue, search | `src/lib/sky/catalog.ts`, `public/data/sky.json` |
| Planets, Moon phase, DSOs | `src/lib/sky/bodies.ts` |
| Mythic figure meshes | `src/lib/sky/figures.ts` |
| Point / line / dome GLSL | `src/lib/sky/shaders.ts` |
| WebGL, WebXR, pick, follow | `src/lib/sky/engine.ts` |
| Gyro / compass / GPS | `src/lib/sky/device.ts` |
| Persist, HUD state | `src/lib/sky/store.ts` |
| Blurbs, asterisms | `src/lib/sky/copy.ts` |
| Chrome, intro, sheets | `src/components/sky-*.tsx` |
| Typeface, night palette | `src/styles.css`, `src/routes/__root.tsx` |

Ignore `src/lib/auth`, `src/lib/db.ts`, and `migrations/` unless your issue
is specifically “remove unused host scaffolding”. Zenith does not sign anyone
in.

## Rules of the sky

- **Serpens.** Caput and Cauda share IAU id `Ser`. List keys must be
  `` `${c.id}-${c.name}` ``, never `c.id` alone.
- **Persistence.** `STORAGE_KEY` is `zenith-sky-v2`. Persist mode, location,
  magnitude, and layer toggles. Do **not** persist `introOpen` or
  `followDevice`.
- **Follow.** Device orientation is a phone feature. Do not show the Follow
  chip on fine pointers. `lookAtWorld`, `lookAzimuth`, and `enterXR` must
  disable follow.
- **No R3F.** The renderer is a plain `THREE.WebGLRenderer` owned by
  `SkyEngine`. Do not wrap the sky in `@react-three/fiber` without an issue
  that says why.
- **No WASD.** This is a vault, not a walkable room.
- **Palette.** Near-black and cool silver. No gold, no purple, no emoji in
  the HUD. Fraunces for titles, Outfit for UI.
- **Pick radius.** Touch needs a fatter hit than mouse. Keep the coarse
  factor if you retune picking.
- **Reduced motion.** Gather still arrives; it does not flourish.

## Good first contributions

- A constellation blurb (`src/lib/sky/copy.ts`) — one figure, in the voice
  of the existing lines (no mythology dump, no emoji).
- One deep-sky object in `DEEP_SKY` (`src/lib/sky/bodies.ts`) with RA/Dec
  and a short line of why it matters.
- A test file next to `astro.ts` for LST and a known alt-az at a city.
- i18n of HUD strings, starting with Russian.

Larger work (Milky Way photometry, ISS, native Android XR) needs a design
note in the issue before a pull request.

## Pull requests

- Keep the diff to the issue. A bug fix does not need a refactor of the HUD.
- `npm run typecheck` must pass.
- If you touch shaders or `SkyEngine`, say how you looked at the sky
  (desktop drag, phone follow, or XR).
- Do not commit `node_modules`, `.env`, or `.grok/`.
- Do not add accounts, ads, or a paywall in front of the stars.

Use the pull request template. A screenshot of Gather / Follow / a figure
is worth more than a paragraph.

## Code of conduct

Everyone in this repository is under [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
The night is wide enough.
