# Claude Code — Zenith

You are working in **Zenith**, a WebXR planetarium. The GitHub repo is
`d-prybytak/arconstellations`. The product name is **Zenith**, not
“arconstellations” and not a PoC.

Read `README.md`, `docs/ARCHITECTURE.md`, and `CONTRIBUTING.md` before
editing. Do not invent a second architecture.

## Run

Node 22+ (`cat .nvmrc`). Auth and the database stay **off**.

```bash
cp .env.example .env   # once
npm install
npm run dev            # http://localhost:8080
npm run typecheck
```

Do not start extra servers. Do not add Docker.

## Where to edit

| Change | File |
| --- | --- |
| Star math, LST, alt-az | `src/lib/sky/astro.ts` |
| Packed catalogue | `src/lib/sky/catalog.ts`, `public/data/sky.json` |
| Planets / Moon / DSOs | `src/lib/sky/bodies.ts` |
| Mythic figures | `src/lib/sky/figures.ts` |
| GLSL | `src/lib/sky/shaders.ts` |
| WebGL / WebXR / pick / follow | `src/lib/sky/engine.ts` |
| Gyro / compass / GPS | `src/lib/sky/device.ts` |
| Persist / HUD state | `src/lib/sky/store.ts` |
| Blurbs | `src/lib/sky/copy.ts` |
| Chrome | `src/components/sky-*.tsx` |
| Palette / type | `src/styles.css` |

Ignore `src/lib/auth`, `src/lib/db.ts`, `migrations/`, `scripts/*` host glue,
and `public/__grok/` unless the issue is “strip unused scaffolding”.

## Hard rules

- Serpens Caput and Cauda share IAU id `Ser`. React keys: `` `${id}-${name}` ``.
- `STORAGE_KEY` is `zenith-sky-v2`. Do not persist `introOpen` or `followDevice`.
- No React Three Fiber. `SkyEngine` owns a plain `THREE.WebGLRenderer`.
- No WASD. This is a vault, not a room.
- Palette: near-black + cool silver. No gold, no purple, no emoji in the HUD.
- Follow-device is a **phone** feature (`pointer: coarse`). `lookAtWorld`,
  `lookAzimuth`, and `enterXR` must disable follow.
- The sky stays free. Do not add accounts, ads, or a paywall in front of stars.
- Do not commit `node_modules`, `.env`, `.grok/`, or `screenshots/app-builder-*`.

## First session on a fresh clone

If the human just unpacked the source onto an empty GitHub repo:

1. Confirm `LICENSE`, `README.md`, `CONTRIBUTING.md`, `NOTICE.md` are present.
2. Do **not** rewrite the renderer or restyle the HUD.
3. Open the five good-first issues listed in `README.md` via `gh issue create`.
4. Set the GitHub About text to Zenith (not “AR Planetarium PoC”) if `gh` is
   authenticated.
5. Run `npm install && npm run typecheck`. Fix only what you broke.

Commits and PR titles in English. Issue bodies may be English or Russian.
