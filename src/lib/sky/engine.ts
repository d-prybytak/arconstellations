import * as THREE from "three";
import {
  bvToRgb,
  equatorialToAltAz,
  equatorialToCartesian,
  lstHours,
} from "./astro";
import {
  DEEP_SKY,
  paintDeepSky,
  paintMoonPhase,
  solarSystem,
  type DeepSky,
  type SolarBody,
} from "./bodies";
import { constellationStarCount, loadSkyCatalog } from "./catalog";
import {
  motionCapability,
  requestMotionPermission,
  screenAngleDeg,
} from "./device";
import { figureFor } from "./figures";
import {
  DOME_FRAGMENT,
  DOME_VERTEX,
  FIGURE_FRAGMENT,
  FIGURE_VERTEX,
  LINE_FRAGMENT,
  LINE_VERTEX,
  STAR_FRAGMENT,
  STAR_VERTEX,
} from "./shaders";
import { useSkyStore } from "./store";
import type { Constellation, SelectedObject, SkyCatalog, Star } from "./types";

const SKY_RADIUS = 420;
const PRESENT_DISTANCE = 2.15;
const DEG = Math.PI / 180;

type PointerMode = "idle" | "drag" | "pinch" | "xr";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getXR():
  | {
      isSessionSupported: (mode: string) => Promise<boolean>;
      requestSession: (mode: string, opts?: Record<string, unknown>) => Promise<unknown>;
    }
  | undefined {
  return (
    navigator as Navigator & {
      xr?: {
        isSessionSupported: (m: string) => Promise<boolean>;
        requestSession: (m: string, o?: Record<string, unknown>) => Promise<unknown>;
      };
    }
  ).xr;
}

export class SkyEngine {
  private canvas: HTMLCanvasElement;
  private labelsEl: HTMLElement;
  private overlayEl: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private skyGroup = new THREE.Group();
  private presentGroup = new THREE.Group();
  private figureGroup = new THREE.Group();
  private bodyGroup = new THREE.Group();
  private dsoGroup = new THREE.Group();
  private ground: THREE.Mesh;
  private horizon: THREE.Mesh;
  private landscape: THREE.Mesh;
  private dome: THREE.Mesh;
  private milkyWay: THREE.Mesh;
  private cardinals: THREE.Group;
  private starsMesh: THREE.Points | null = null;
  private linesMesh: THREE.LineSegments | null = null;
  private starMaterial: THREE.ShaderMaterial | null = null;
  private lineMaterial: THREE.ShaderMaterial | null = null;
  private domeMaterial: THREE.ShaderMaterial;
  private catalog: SkyCatalog | null = null;
  private starPositions = new Float32Array();
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private tmp3 = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private qLst = new THREE.Quaternion();
  private qLat = new THREE.Quaternion();
  private qHead = new THREE.Quaternion();
  private xAxis = new THREE.Vector3(1, 0, 0);
  private yAxis = new THREE.Vector3(0, 1, 0);
  private zAxis = new THREE.Vector3(0, 0, 1);
  private orientEuler = new THREE.Euler();
  private qMinusHalfX = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  private lookYaw = 0.35;
  private lookPitch = 0.18;
  private fov = 68;
  private pointer: PointerMode = "idle";
  private lastPointer = { x: 0, y: 0, t: 0 };
  private moved = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch0 = 0;
  private fov0 = 68;
  private lastTime = 0;
  private lastAzPub = 0;
  private lastMoonKey = "";
  private disposed = false;
  private ro: ResizeObserver | null = null;
  private controllers: THREE.Object3D[] = [];
  private present: {
    kind: string;
    t: number;
    duration: number;
    from: THREE.Vector3;
    spinning: boolean;
    inner: THREE.Object3D | null;
  } | null = null;
  private labelNodes = new Map<string, HTMLDivElement>();
  private figureMats = new Map<string, THREE.ShaderMaterial>();
  private bodySprites = new Map<string, THREE.Sprite>();
  private moonSprite: THREE.Sprite | null = null;
  private raycaster = new THREE.Raycaster();
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundKey: (e: KeyboardEvent) => void;
  private boundResize: () => void;
  private boundOrient: (e: DeviceOrientationEvent) => void;
  private deviceQuat = new THREE.Quaternion();
  private deviceLive = false;
  private gotAbsolute = false;
  private orientListening = false;
  private bodies: SolarBody[] = [];

  constructor(opts: {
    canvas: HTMLCanvasElement;
    labelsEl: HTMLElement;
    overlayEl: HTMLElement;
  }) {
    this.canvas = opts.canvas;
    this.labelsEl = opts.labelsEl;
    this.overlayEl = opts.overlayEl;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(
      this.canvas.clientWidth || window.innerWidth,
      this.canvas.clientHeight || window.innerHeight,
      false,
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType("local-floor");

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07080c);

    this.camera = new THREE.PerspectiveCamera(
      this.fov,
      Math.max((this.canvas.clientWidth || 1) / (this.canvas.clientHeight || 1), 0.2),
      0.05,
      2400,
    );
    this.camera.position.set(0, 1.6, 0);
    this.applyLook();

    this.scene.add(this.skyGroup);
    this.skyGroup.add(this.figureGroup);
    this.skyGroup.add(this.bodyGroup);
    this.skyGroup.add(this.dsoGroup);
    this.scene.add(this.presentGroup);
    this.presentGroup.frustumCulled = false;

    this.domeMaterial = new THREE.ShaderMaterial({
      vertexShader: DOME_VERTEX,
      fragmentShader: DOME_FRAGMENT,
      uniforms: {
        uZenith: { value: new THREE.Color(0x07080c) },
        uHorizon: { value: new THREE.Color(0x121826) },
        uGlow: { value: new THREE.Color(0x2a3a52) },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 32), this.domeMaterial);
    this.scene.add(this.dome);

    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(90, 72),
      new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0.94 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0;
    this.scene.add(this.ground);

    this.horizon = new THREE.Mesh(
      new THREE.RingGeometry(22, 64, 96),
      new THREE.MeshBasicMaterial({
        color: 0x243044,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.horizon.rotation.x = -Math.PI / 2;
    this.horizon.position.y = 0.04;
    this.scene.add(this.horizon);

    this.landscape = this.makeLandscape();
    this.scene.add(this.landscape);

    this.cardinals = this.makeCardinals();
    this.scene.add(this.cardinals);

    this.milkyWay = this.makeMilkyWay();
    this.skyGroup.add(this.milkyWay);

    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundKey = this.onKey.bind(this);
    this.boundResize = this.resize.bind(this);
    this.boundOrient = this.onOrientation.bind(this);

    this.canvas.addEventListener("pointerdown", this.boundPointerDown);
    window.addEventListener("pointermove", this.boundPointerMove);
    window.addEventListener("pointerup", this.boundPointerUp);
    window.addEventListener("pointercancel", this.boundPointerUp);
    this.canvas.addEventListener("wheel", this.boundWheel, { passive: false });
    window.addEventListener("keydown", this.boundKey);
    window.addEventListener("resize", this.boundResize);
    window.visualViewport?.addEventListener("resize", this.boundResize);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas.parentElement || this.canvas);

    this.setupControllers();
  }

  async start() {
    try {
      const catalog = await loadSkyCatalog();
      if (this.disposed) return;
      this.catalog = catalog;
      this.buildSky(catalog);
      this.buildBodies();
      this.buildDeepSky();
      this.buildLabels(catalog);
      this.orientSky(useSkyStore.getState());
      this.updateBodies(useSkyStore.getState());
      this.lookAtWorld(this.eqWorld(84, 13));
      useSkyStore.getState().setMotion(motionCapability());
      useSkyStore.getState().setReady(true);
      void this.detectXR();
      this.renderer.setAnimationLoop(this.tick);
      this.queueFigures(catalog);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not chart the sky";
      useSkyStore.getState().setError(message);
    }
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.canvas.removeEventListener("pointerdown", this.boundPointerDown);
    window.removeEventListener("pointermove", this.boundPointerMove);
    window.removeEventListener("pointerup", this.boundPointerUp);
    window.removeEventListener("pointercancel", this.boundPointerUp);
    this.canvas.removeEventListener("wheel", this.boundWheel);
    window.removeEventListener("keydown", this.boundKey);
    window.removeEventListener("resize", this.boundResize);
    window.visualViewport?.removeEventListener("resize", this.boundResize);
    this.stopOrientation();
    this.ro?.disconnect();
    this.starMaterial?.dispose();
    this.lineMaterial?.dispose();
    this.starsMesh?.geometry.dispose();
    this.linesMesh?.geometry.dispose();
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.horizon.geometry.dispose();
    (this.horizon.material as THREE.Material).dispose();
    this.milkyWay.geometry.dispose();
    (this.milkyWay.material as THREE.Material).dispose();
    this.dome.geometry.dispose();
    this.domeMaterial.dispose();
    this.landscape.geometry.dispose();
    (this.landscape.material as THREE.Material).dispose();
    this.figureMats.forEach((m) => {
      m.uniforms.uMap.value?.dispose();
      m.dispose();
    });
    this.bodySprites.forEach((s) => {
      s.material.map?.dispose();
      s.material.dispose();
    });
    this.clearPresent();
    this.renderer.dispose();
  }

  async enterXR() {
    const xr = getXR();
    if (!xr) throw new Error("WebXR is not available in this browser");
    const ar = await xr.isSessionSupported("immersive-ar").catch(() => false);
    const vr = await xr.isSessionSupported("immersive-vr").catch(() => false);
    const mode = ar ? "immersive-ar" : vr ? "immersive-vr" : null;
    if (!mode) throw new Error("This headset does not expose an immersive WebXR session");

    const sessionInit: Record<string, unknown> = {
      requiredFeatures: ["local-floor"],
      optionalFeatures: [
        "hand-tracking",
        "hit-test",
        "unbounded",
        "anchors",
        "plane-detection",
        "dom-overlay",
      ],
    };
    if (mode === "immersive-ar") {
      sessionInit.domOverlay = { root: this.overlayEl };
    }

    const session = (await xr.requestSession(mode, sessionInit)) as {
      addEventListener: (type: string, fn: () => void) => void;
    };
    await this.renderer.xr.setSession(session as never);
    session.addEventListener("end", () => {
      useSkyStore.getState().setXrActive(false);
      this.scene.background = new THREE.Color(0x07080c);
      this.dome.visible = true;
    });
    useSkyStore.getState().setXrActive(true);
    useSkyStore.getState().setIntroOpen(false);
    this.disableFollow();
    this.scene.background = ar ? null : new THREE.Color(0x05060a);
    if (ar) this.dome.visible = false;
  }

  async exitXR() {
    const session = this.renderer.xr.getSession();
    if (session) await session.end();
  }

  async enableFollow() {
    const ok = await requestMotionPermission();
    if (!ok) {
      useSkyStore.getState().setMotion("denied");
      useSkyStore.getState().setFollowDevice(false);
      return false;
    }
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.startOrientation();
    useSkyStore.getState().setMotion("live");
    useSkyStore.getState().setFollowDevice(true);
    return true;
  }

  disableFollow() {
    if (!useSkyStore.getState().followDevice && !this.orientListening) return;
    this.applyLook();
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, "YXZ");
    this.lookPitch = euler.x;
    this.lookYaw = euler.y;
    this.stopOrientation();
    useSkyStore.getState().setFollowDevice(false);
    const motion = useSkyStore.getState().motion;
    if (motion === "live") useSkyStore.getState().setMotion("ready");
  }

  async toggleFollow() {
    if (useSkyStore.getState().followDevice) this.disableFollow();
    else await this.enableFollow();
  }

  private startOrientation() {
    if (this.orientListening) return;
    this.gotAbsolute = false;
    this.deviceLive = false;
    window.addEventListener("deviceorientationabsolute", this.boundOrient, true);
    window.addEventListener("deviceorientation", this.boundOrient, true);
    window.addEventListener("orientationchange", this.boundResize);
    this.orientListening = true;
  }

  private stopOrientation() {
    if (!this.orientListening) return;
    window.removeEventListener("deviceorientationabsolute", this.boundOrient, true);
    window.removeEventListener("deviceorientation", this.boundOrient, true);
    window.removeEventListener("orientationchange", this.boundResize);
    this.orientListening = false;
    this.deviceLive = false;
  }

  private onOrientation(e: DeviceOrientationEvent) {
    if (this.disposed) return;
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    const absolute = e.absolute === true || e.type === "deviceorientationabsolute";
    if (absolute) this.gotAbsolute = true;
    if (!absolute && this.gotAbsolute && e.type === "deviceorientation") return;

    const compass = (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
      .webkitCompassHeading;
    const alpha =
      typeof compass === "number" && !Number.isNaN(compass)
        ? (360 - compass) * DEG
        : e.alpha * DEG;
    const beta = e.beta * DEG;
    const gamma = e.gamma * DEG;
    const orient = screenAngleDeg() * DEG;

    this.orientEuler.set(beta, alpha, -gamma, "YXZ");
    this.deviceQuat.setFromEuler(this.orientEuler);
    this.deviceQuat.multiply(this.qMinusHalfX);
    this.tmpQ.setFromAxisAngle(this.zAxis, -orient);
    this.deviceQuat.multiply(this.tmpQ);
    this.deviceLive = true;
  }

  presentSelection(selected: SelectedObject) {
    const catalog = this.catalog;
    if (!catalog) return;
    this.clearPresent();
    const reduced = prefersReducedMotion();
    if (selected.kind === "star") {
      const star = catalog.stars.find((s) => s.hip === selected.hip);
      if (!star) return;
      const from = this.starWorldPosition(star);
      const group = this.makeStarPresent(star);
      this.presentGroup.add(group);
      this.present = {
        kind: "star",
        t: reduced ? 1 : 0,
        duration: 1.7,
        from,
        spinning: true,
        inner: group,
      };
    } else if (selected.kind === "constellation") {
      const con = catalog.constellations.find((c) => c.id === selected.id);
      if (!con) return;
      const from = this.eqWorld(con.ra, con.dec);
      const group = this.makeConstellationPresent(con);
      this.presentGroup.add(group);
      this.present = {
        kind: "constellation",
        t: reduced ? 1 : 0,
        duration: 2.05,
        from,
        spinning: true,
        inner: group,
      };
    } else if (selected.kind === "body") {
      const body = this.bodies.find((b) => b.id === selected.id);
      if (!body) return;
      const from = this.eqWorld(body.ra, body.dec);
      const group = this.makeBodyPresent(body);
      this.presentGroup.add(group);
      this.present = {
        kind: "body",
        t: reduced ? 1 : 0,
        duration: 1.6,
        from,
        spinning: selected.id !== "moon",
        inner: group,
      };
    } else {
      const dso = DEEP_SKY.find((d) => d.id === selected.id);
      if (!dso) return;
      const from = this.eqWorld(dso.ra, dso.dec);
      const group = this.makeDsoPresent(dso);
      this.presentGroup.add(group);
      this.present = {
        kind: "dso",
        t: reduced ? 1 : 0,
        duration: 1.8,
        from,
        spinning: true,
        inner: group,
      };
    }
  }

  dismissPresent() {
    this.clearPresent();
    useSkyStore.getState().setSelected(null);
  }

  private tick = (time: number) => {
    if (this.disposed) return;
    const tSec = time * 0.001;
    const dt = Math.min((time - this.lastTime) / 1000 || 0.016, 0.1);
    this.lastTime = time;

    const state = useSkyStore.getState();
    if (state.playing) {
      useSkyStore.setState({ timeOffsetHours: state.timeOffsetHours + dt * 0.45 });
    }

    this.syncFromStore(useSkyStore.getState(), tSec);
    this.updatePresent(dt);
    this.updateLabels();
    if (!this.renderer.xr.isPresenting) this.applyLook();
    if (time - this.lastAzPub > 220) {
      this.lastAzPub = time;
      this.camera.getWorldDirection(this.tmp);
      let az = ((Math.atan2(this.tmp.x, -this.tmp.z) * 180) / Math.PI + 360) % 360;
      if (state.mode === "outdoor") {
        az = (az - state.headingOffsetDeg + 360) % 360;
      }
      if (Math.abs(state.viewAz - az) > 1.2) {
        useSkyStore.getState().setViewAz(az);
      }
    }
    this.renderer.render(this.scene, this.camera);
  };

  private syncFromStore(
    state: ReturnType<typeof useSkyStore.getState>,
    tSec: number,
  ) {
    this.orientSky(state);
    this.updateBodies(state);

    const clip = state.mode === "outdoor" ? 1 : 0;
    const dim = state.selected ? 1 : 0;
    if (this.starMaterial) {
      this.starMaterial.uniforms.uTime.value = tSec;
      this.starMaterial.uniforms.uMagLimit.value = state.magLimit;
      this.starMaterial.uniforms.uTwinkle.value = prefersReducedMotion() ? 0 : 1;
      this.starMaterial.uniforms.uDim.value = dim;
      this.starMaterial.uniforms.uHorizonClip.value = clip;
      this.starMaterial.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    }
    if (this.lineMaterial) {
      this.lineMaterial.uniforms.uDim.value = dim;
      this.lineMaterial.uniforms.uHorizonClip.value = clip;
      this.lineMaterial.uniforms.uColor.value.set(state.showFigures ? 0xc4b496 : 0x9aa3b0);
    }
    if (this.linesMesh) this.linesMesh.visible = state.showLines;
    this.figureGroup.visible = state.showFigures;
    this.bodyGroup.visible = state.showPlanets;
    this.dsoGroup.visible = state.magLimit >= 4.2;
    const selectedId = state.selected?.kind === "constellation" ? state.selected.id : "";
    this.figureMats.forEach((mat, id) => {
      mat.uniforms.uDim.value = dim;
      mat.uniforms.uHorizonClip.value = clip;
      mat.uniforms.uHighlight.value = id === selectedId ? 1 : 0;
    });

    const outdoor = state.mode === "outdoor" && !state.xrActive;
    this.ground.visible = !state.xrActive;
    this.horizon.visible = outdoor;
    this.landscape.visible = outdoor;
    this.cardinals.visible = outdoor;
    this.dome.visible = !state.xrActive;
    (this.ground.material as THREE.MeshBasicMaterial).opacity = outdoor ? 0.94 : 0.78;
    this.labelsEl.style.opacity = state.showNames && !state.xrActive ? "1" : "0";
  }

  private orientSky(state: ReturnType<typeof useSkyStore.getState>) {
    this.qHead.setFromAxisAngle(this.yAxis, state.headingOffsetDeg * DEG);
    if (state.mode === "outdoor") {
      const date = new Date(Date.now() + state.timeOffsetHours * 3600_000);
      const lst = lstHours(date, state.lon);
      this.qLst.setFromAxisAngle(this.yAxis, lst * 15 * DEG + Math.PI);
      this.qLat.setFromAxisAngle(this.xAxis, (state.lat - 90) * DEG);
      this.skyGroup.quaternion.copy(this.qHead).multiply(this.qLat).multiply(this.qLst);
    } else {
      this.skyGroup.quaternion.copy(this.qHead);
    }
  }

  private buildSky(catalog: SkyCatalog) {
    const n = catalog.stars.length;
    const positions = new Float32Array(n * 3);
    const mag = new Float32Array(n);
    const phase = new Float32Array(n);
    const bv = new Float32Array(n);
    this.starPositions = positions;

    for (let i = 0; i < n; i++) {
      const s = catalog.stars[i]!;
      const p = equatorialToCartesian(s.ra, s.dec, SKY_RADIUS);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      mag[i] = s.mag;
      bv[i] = s.bv;
      phase[i] = Math.abs(Math.sin(s.hip * 12.9898) * 43758.5453) % 1;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aMag", new THREE.BufferAttribute(mag, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    geo.setAttribute("aBv", new THREE.BufferAttribute(bv, 1));

    this.starMaterial = new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uMagLimit: { value: 5.2 },
        uTwinkle: { value: 1 },
        uDim: { value: 0 },
        uHorizonClip: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.starsMesh = new THREE.Points(geo, this.starMaterial);
    this.starsMesh.frustumCulled = false;
    this.skyGroup.add(this.starsMesh);

    const linePos: number[] = [];
    for (const con of catalog.constellations) {
      for (const path of con.paths) {
        for (let i = 0; i < path.length - 1; i++) {
          const a = equatorialToCartesian(path[i]![0], path[i]![1], SKY_RADIUS);
          const b = equatorialToCartesian(path[i + 1]![0], path[i + 1]![1], SKY_RADIUS);
          linePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
    this.lineMaterial = new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX,
      fragmentShader: LINE_FRAGMENT,
      uniforms: {
        uColor: { value: new THREE.Color(0xc4b496) },
        uDim: { value: 0 },
        uHorizonClip: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    this.linesMesh = new THREE.LineSegments(lineGeo, this.lineMaterial);
    this.linesMesh.frustumCulled = false;
    this.skyGroup.add(this.linesMesh);
  }

  private queueFigures(catalog: SkyCatalog) {
    const list = catalog.constellations.filter((c) => c.rank <= 2);
    let i = 0;
    const step = () => {
      if (this.disposed) return;
      const end = Math.min(i + 3, list.length);
      for (; i < end; i++) this.addFigure(list[i]!);
      if (i < list.length) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private addFigure(con: Constellation) {
    const mat = new THREE.Matrix4();
    const x = new THREE.Vector3();
    const y = new THREE.Vector3();
    const z = new THREE.Vector3();
    const art = figureFor(con);
    if (!art) return;
    const tex = new THREE.CanvasTexture(art.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const shader = new THREE.ShaderMaterial({
      vertexShader: FIGURE_VERTEX,
      fragmentShader: FIGURE_FRAGMENT,
      uniforms: {
        uMap: { value: tex },
        uDim: { value: 0 },
        uHorizonClip: { value: 0 },
        uHighlight: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(art.width * SKY_RADIUS, art.height * SKY_RADIUS),
      shader,
    );
    mesh.position.set(
      art.center[0] * SKY_RADIUS,
      art.center[1] * SKY_RADIUS,
      art.center[2] * SKY_RADIUS,
    );
    x.set(art.right[0], art.right[1], art.right[2]);
    y.set(art.up[0], art.up[1], art.up[2]);
    z.set(-art.center[0], -art.center[1], -art.center[2]).normalize();
    x.crossVectors(y, z).normalize();
    y.crossVectors(z, x).normalize();
    mat.makeBasis(x, y, z);
    mesh.quaternion.setFromRotationMatrix(mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    this.figureGroup.add(mesh);
    this.figureMats.set(con.id, shader);
  }

  private glowSprite(color: [number, number, number], core = 0.95) {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, `rgba(${color[0] * 255},${color[1] * 255},${color[2] * 255},${core})`);
    g.addColorStop(0.18, `rgba(${color[0] * 255},${color[1] * 255},${color[2] * 255},0.7)`);
    g.addColorStop(0.42, `rgba(${color[0] * 255},${color[1] * 255},${color[2] * 255},0.22)`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Sprite(mat);
  }

  private buildBodies() {
    const sun = this.glowSprite([1, 0.93, 0.72], 1);
    sun.scale.setScalar(10);
    this.bodyGroup.add(sun);
    this.bodySprites.set("sun", sun);

    const moon = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(paintMoonPhase(0.7, true)),
        transparent: true,
        depthWrite: false,
      }),
    );
    moon.scale.setScalar(8.5);
    this.bodyGroup.add(moon);
    this.bodySprites.set("moon", moon);
    this.moonSprite = moon;

    const colors: Record<string, [number, number, number]> = {
      mercury: [0.72, 0.7, 0.66],
      venus: [0.95, 0.88, 0.7],
      mars: [0.92, 0.48, 0.32],
      jupiter: [0.93, 0.82, 0.62],
      saturn: [0.9, 0.82, 0.58],
      uranus: [0.62, 0.86, 0.88],
      neptune: [0.42, 0.58, 0.92],
    };
    const sizes: Record<string, number> = {
      mercury: 3.2,
      venus: 4.8,
      mars: 3.8,
      jupiter: 6.2,
      saturn: 5.6,
      uranus: 3.6,
      neptune: 3.5,
    };
    for (const id of Object.keys(colors)) {
      const spr = this.glowSprite(colors[id]!, 0.9);
      spr.scale.setScalar(sizes[id] ?? 6);
      this.bodyGroup.add(spr);
      this.bodySprites.set(id, spr);
    }
  }

  private buildDeepSky() {
    for (const obj of DEEP_SKY) {
      const tex = new THREE.CanvasTexture(paintDeepSky(obj));
      tex.colorSpace = THREE.SRGBColorSpace;
      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0.85,
        }),
      );
      const p = equatorialToCartesian(obj.ra, obj.dec, SKY_RADIUS * 0.985);
      spr.position.set(p.x, p.y, p.z);
      spr.scale.setScalar(obj.size * 1.35);
      this.dsoGroup.add(spr);
      this.bodySprites.set(obj.id, spr);
    }
  }

  private updateBodies(state: ReturnType<typeof useSkyStore.getState>) {
    const date = new Date(Date.now() + state.timeOffsetHours * 3600_000);
    this.bodies = solarSystem(date);
    for (const body of this.bodies) {
      const spr = this.bodySprites.get(body.id);
      if (!spr) continue;
      const p = equatorialToCartesian(body.ra, body.dec, SKY_RADIUS * 0.992);
      spr.position.set(p.x, p.y, p.z);
      if (body.id === "moon") {
        const key = `${body.phase.toFixed(2)}-${body.waxing ? "w" : "e"}`;
        if (key !== this.lastMoonKey && this.moonSprite) {
          this.lastMoonKey = key;
          const tex = new THREE.CanvasTexture(paintMoonPhase(body.phase, body.waxing));
          tex.colorSpace = THREE.SRGBColorSpace;
          const old = this.moonSprite.material.map;
          this.moonSprite.material.map = tex;
          this.moonSprite.material.needsUpdate = true;
          old?.dispose();
        }
      }
      if (state.mode === "outdoor") {
        const lst = lstHours(date, state.lon);
        const { alt } = equatorialToAltAz(body.ra, body.dec, state.lat, lst);
        spr.visible = alt > -1.2 || body.id === "sun";
        if (body.id === "sun") spr.visible = alt > -6;
      } else {
        spr.visible = true;
      }
    }
  }

  private makeMilkyWay() {
    const geo = new THREE.SphereGeometry(SKY_RADIUS * 0.995, 64, 32);
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 2048, 1024);
    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * 2048;
      const bulge = Math.exp(-Math.pow((x - 1100) / 420, 2));
      const y = 512 + (Math.random() * 2 - 1) * (22 + Math.random() * 90) * (0.55 + bulge);
      const a = (0.018 + Math.random() * 0.07) * (0.45 + bulge);
      const r = 10 + Math.random() * 54;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(220,210,230,${a})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 80; i++) {
      const x = 900 + Math.random() * 500;
      const y = 512 + (Math.random() * 2 - 1) * 70;
      const r = 12 + Math.random() * 28;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(0,0,0,0.55)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = "source-over";
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = THREE.MathUtils.degToRad(62.87);
    mesh.rotation.y = THREE.MathUtils.degToRad(192.86);
    return mesh;
  }

  private makeLandscape() {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 2048, 256);
    ctx.fillStyle = "#05060a";
    const ridge = (base: number, amp: number, freq: number, seed: number) => {
      ctx.beginPath();
      ctx.moveTo(0, 256);
      for (let x = 0; x <= 2048; x += 8) {
        const y =
          base +
          Math.sin(x * freq + seed) * amp +
          Math.sin(x * freq * 2.4 + seed * 1.7) * amp * 0.45;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(2048, 256);
      ctx.closePath();
      ctx.fill();
    };
    ridge(148, 18, 0.004, 1.2);
    ctx.fillStyle = "#07080c";
    ridge(168, 22, 0.007, 4.1);
    ctx.fillStyle = "#05060a";
    for (let i = 0; i < 90; i++) {
      const x = (i / 90) * 2048 + Math.sin(i * 3.1) * 12;
      const h = 18 + (i % 5) * 7;
      ctx.beginPath();
      ctx.moveTo(x - 7, 220);
      ctx.lineTo(x, 220 - h);
      ctx.lineTo(x + 7, 220);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.CylinderGeometry(78, 78, 14, 64, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 6.2;
    return mesh;
  }

  private makeCardinals() {
    const group = new THREE.Group();
    const letters = [
      ["N", 0],
      ["E", 90],
      ["S", 180],
      ["W", 270],
    ] as const;
    for (const [label, az] of letters) {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "rgba(232,234,238,0.82)";
      ctx.font = "700 72px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 64, 70);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
      );
      const rad = az * DEG;
      spr.position.set(Math.sin(rad) * 42, 2.4, -Math.cos(rad) * 42);
      spr.scale.set(3.2, 3.2, 1);
      group.add(spr);
    }
    return group;
  }

  private buildLabels(catalog: SkyCatalog) {
    this.labelsEl.replaceChildren();
    this.labelNodes.clear();
    const ranked = catalog.constellations.filter((c) => c.rank <= 2);
    for (const con of ranked) {
      const el = document.createElement("div");
      el.textContent = con.name;
      el.className = "sky-constellation-label";
      this.labelsEl.appendChild(el);
      this.labelNodes.set(`c:${con.id}`, el);
    }
    for (const s of catalog.stars) {
      if (!s.name || s.mag > 1.55) continue;
      const el = document.createElement("div");
      el.textContent = s.name;
      el.className = "sky-star-label";
      this.labelsEl.appendChild(el);
      this.labelNodes.set(`s:${s.hip}`, el);
    }
    for (const id of ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"]) {
      const el = document.createElement("div");
      el.className = "sky-body-label";
      this.labelsEl.appendChild(el);
      this.labelNodes.set(`b:${id}`, el);
    }
  }

  private updateLabels() {
    const catalog = this.catalog;
    if (!catalog) return;
    const state = useSkyStore.getState();
    if (!state.showNames || state.introOpen) {
      for (const el of this.labelNodes.values()) el.style.display = "none";
      return;
    }
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const cam = this.activeCamera();
    const place = (key: string, world: THREE.Vector3, minY: number) => {
      const el = this.labelNodes.get(key);
      if (!el) return;
      this.tmp.copy(world).project(cam);
      const visible =
        this.tmp.z < 1 &&
        this.tmp.x > -1.05 &&
        this.tmp.x < 1.05 &&
        this.tmp.y > -1.05 &&
        this.tmp.y < 1.05 &&
        (state.mode === "indoor" || world.y > minY);
      if (!visible) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      el.style.left = `${((this.tmp.x + 1) / 2) * w}px`;
      el.style.top = `${((1 - this.tmp.y) / 2) * h}px`;
    };

    for (const con of catalog.constellations) {
      if (con.rank > 2) continue;
      place(`c:${con.id}`, this.eqWorld(con.ra, con.dec), 8);
    }
    for (const s of catalog.stars) {
      if (!s.name || s.mag > 1.55) continue;
      if (s.mag > state.magLimit) {
        const el = this.labelNodes.get(`s:${s.hip}`);
        if (el) el.style.display = "none";
        continue;
      }
      place(`s:${s.hip}`, this.eqWorld(s.ra, s.dec), 6);
    }
    if (state.showPlanets) {
      for (const body of this.bodies) {
        const el = this.labelNodes.get(`b:${body.id}`);
        if (!el) continue;
        el.textContent = body.name;
        const spr = this.bodySprites.get(body.id);
        if (!spr || !spr.visible) {
          el.style.display = "none";
          continue;
        }
        place(`b:${body.id}`, this.eqWorld(body.ra, body.dec), 4);
      }
    } else {
      for (const id of ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"]) {
        const el = this.labelNodes.get(`b:${id}`);
        if (el) el.style.display = "none";
      }
    }
  }

  private applyLook() {
    const follow = useSkyStore.getState().followDevice && this.deviceLive;
    if (follow) {
      this.camera.quaternion.copy(this.deviceQuat);
      this.qHead.setFromAxisAngle(this.yAxis, this.lookYaw);
      this.camera.quaternion.premultiply(this.qHead);
      this.camera.rotateX(this.lookPitch);
    } else {
      this.camera.rotation.set(this.lookPitch, this.lookYaw, 0, "YXZ");
    }
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  private activeCamera() {
    if (this.renderer.xr.isPresenting) return this.renderer.xr.getCamera();
    return this.camera;
  }

  private onPointerDown(e: PointerEvent) {
    if (e.cancelable) e.preventDefault();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const store = useSkyStore.getState();
    if (store.introOpen) store.setIntroOpen(false);
    store.setDragging(true);

    if (this.pointers.size >= 2) {
      this.pointer = "pinch";
      this.pinch0 = this.pinchDistance();
      this.fov0 = this.fov;
      this.moved = 999;
      return;
    }

    this.pointer = "drag";
    this.moved = 0;
    this.lastPointer = { x: e.clientX, y: e.clientY, t: performance.now() };
  }

  private onPointerMove(e: PointerEvent) {
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (this.pointer === "pinch") {
      const d = this.pinchDistance();
      if (this.pinch0 > 8 && d > 8) {
        this.fov = Math.max(28, Math.min(92, this.fov0 * (this.pinch0 / d)));
      }
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    if (this.pointer === "drag") {
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.moved += Math.abs(dx) + Math.abs(dy);
      const gain = useSkyStore.getState().followDevice ? 0.0035 : 0.005;
      this.lookYaw -= dx * gain;
      this.lookPitch = Math.max(-1.2, Math.min(1.2, this.lookPitch - dy * gain));
      this.lastPointer = { x: e.clientX, y: e.clientY, t: this.lastPointer.t };
      const state = useSkyStore.getState();
      if (state.mode === "indoor" && e.shiftKey) {
        state.nudgeHeading(-dx * 0.12);
      }
    } else {
      this.hoverAt(x, y);
    }
  }

  private onPointerUp(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (this.pointer === "pinch") {
      if (this.pointers.size >= 2) return;
      this.pointer = this.pointers.size === 1 ? "drag" : "idle";
      this.moved = 999;
      if (this.pointers.size === 1) {
        const leftover = [...this.pointers.values()][0]!;
        this.lastPointer = { x: leftover.x, y: leftover.y, t: performance.now() };
      } else {
        useSkyStore.getState().setDragging(false);
      }
      return;
    }
    const wasDrag = this.pointer === "drag";
    this.pointer = "idle";
    useSkyStore.getState().setDragging(false);
    if (!wasDrag) return;
    if (this.moved > 8) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.selectAt(x, y);
  }

  private pinchDistance() {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    this.fov = Math.max(28, Math.min(92, this.fov + e.deltaY * 0.03));
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === "Escape") this.dismissPresent();
    const step = e.shiftKey ? 0.08 : 0.035;
    if (e.key === "ArrowLeft") this.lookYaw += step;
    if (e.key === "ArrowRight") this.lookYaw -= step;
    if (e.key === "ArrowUp") this.lookPitch = Math.min(1.2, this.lookPitch + step);
    if (e.key === "ArrowDown") this.lookPitch = Math.max(-1.2, this.lookPitch + step);
  }

  private hoverAt(ndcX: number, ndcY: number) {
    const hit = this.pick(ndcX, ndcY);
    const name = hit?.name ?? null;
    if (name !== useSkyStore.getState().hoveredName) {
      useSkyStore.getState().setHoveredName(name);
    }
    this.canvas.style.cursor = name ? "pointer" : "grab";
  }

  private selectAt(ndcX: number, ndcY: number) {
    const hit = this.pick(ndcX, ndcY);
    if (!hit) {
      this.dismissPresent();
      return;
    }
    useSkyStore.getState().setSelected(hit);
    this.presentSelection(hit);
  }

  pickFromCenter() {
    this.selectAt(0, 0);
  }

  selectConstellation(id: string) {
    const catalog = this.catalog;
    if (!catalog) return;
    const con = catalog.constellations.find((c) => c.id === id);
    if (!con) return;
    const selected: SelectedObject = {
      kind: "constellation",
      id: con.id,
      name: con.name,
      gen: con.gen,
      meaning: con.en,
      starCount: constellationStarCount(con, catalog.stars),
      ra: con.ra,
      dec: con.dec,
    };
    useSkyStore.getState().setSelected(selected);
    this.presentSelection(selected);
    this.lookAtWorld(this.eqWorld(con.ra, con.dec));
  }

  selectStarByHip(hip: number) {
    const catalog = this.catalog;
    if (!catalog) return;
    const star = catalog.stars.find((s) => s.hip === hip);
    if (!star) return;
    const selected = this.starToSelected(star);
    useSkyStore.getState().setSelected(selected);
    this.presentSelection(selected);
    this.lookAtWorld(this.starWorldPosition(star));
  }

  selectBody(id: string) {
    const body = this.bodies.find((b) => b.id === id);
    if (!body) return;
    const selected = this.bodyToSelected(body);
    useSkyStore.getState().setSelected(selected);
    this.presentSelection(selected);
    this.lookAtWorld(this.eqWorld(body.ra, body.dec));
  }

  selectDso(id: string) {
    const dso = DEEP_SKY.find((d) => d.id === id);
    if (!dso) return;
    const selected: SelectedObject = {
      kind: "dso",
      id: dso.id,
      name: dso.name,
      ra: dso.ra,
      dec: dso.dec,
      info: dso.info,
      kindLabel: dso.kind,
    };
    useSkyStore.getState().setSelected(selected);
    this.presentSelection(selected);
    this.lookAtWorld(this.eqWorld(dso.ra, dso.dec));
  }

  lookAzimuth(azDeg: number) {
    if (useSkyStore.getState().followDevice) this.disableFollow();
    const state = useSkyStore.getState();
    const cameraAz =
      state.mode === "outdoor" ? azDeg + state.headingOffsetDeg : azDeg;
    this.lookYaw = -((cameraAz * Math.PI) / 180);
    useSkyStore.getState().setViewAz(((azDeg % 360) + 360) % 360);
  }

  private lookAtWorld(p: THREE.Vector3) {
    if (useSkyStore.getState().followDevice) this.disableFollow();
    this.tmp.copy(p).sub(this.camera.position).normalize();
    this.lookYaw = Math.atan2(-this.tmp.x, -this.tmp.z);
    this.lookPitch = Math.asin(Math.max(-1, Math.min(1, this.tmp.y)));
  }

  private pick(ndcX: number, ndcY: number): SelectedObject | null {
    const catalog = this.catalog;
    if (!catalog) return null;
    const state = useSkyStore.getState();
    const cam = this.activeCamera();
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const q = this.skyGroup.quaternion;
    const fat = navigator.maxTouchPoints > 0 ? 1.35 : 1;
    const screenDist = (world: THREE.Vector3, thresh: number) => {
      this.tmp.copy(world).project(cam);
      if (this.tmp.z > 1 || this.tmp.z < -1) return null;
      const dx = ((this.tmp.x - ndcX) * w) / 2;
      const dy = ((this.tmp.y - ndcY) * h) / 2;
      const d = Math.hypot(dx, dy);
      return d < thresh ? d : null;
    };

    let bestBody: { body: SolarBody; d: number } | null = null;
    if (state.showPlanets) {
      for (const body of this.bodies) {
        const spr = this.bodySprites.get(body.id);
        if (spr && !spr.visible) continue;
        const p = this.eqWorld(body.ra, body.dec);
        if (state.mode === "outdoor" && p.y < -4) continue;
        const thresh = (body.id === "sun" || body.id === "moon" ? 44 : 28) * fat;
        const d = screenDist(p, thresh);
        if (d != null && (!bestBody || d < bestBody.d)) bestBody = { body, d };
      }
    }
    if (bestBody && bestBody.d < 22) return this.bodyToSelected(bestBody.body);

    let bestStar: { i: number; d: number } | null = null;
    const v = this.tmp2;
    for (let i = 0; i < catalog.stars.length; i++) {
      const s = catalog.stars[i]!;
      if (s.mag > state.magLimit) continue;
      v.set(
        this.starPositions[i * 3]!,
        this.starPositions[i * 3 + 1]!,
        this.starPositions[i * 3 + 2]!,
      ).applyQuaternion(q);
      if (state.mode === "outdoor" && v.y < -4) continue;
      this.tmp.copy(v).project(cam);
      if (this.tmp.z > 1 || this.tmp.z < -1) continue;
      const dx = ((this.tmp.x - ndcX) * w) / 2;
      const dy = ((this.tmp.y - ndcY) * h) / 2;
      const d = Math.hypot(dx, dy);
      const thresh = (s.mag < 1 ? 36 : s.mag < 2.5 ? 24 : s.mag < 4 ? 16 : 10) * fat;
      if (d < thresh && (!bestStar || d < bestStar.d)) bestStar = { i, d };
    }

    let bestDso: { dso: DeepSky; d: number } | null = null;
    if (state.magLimit >= 4.2) {
      for (const dso of DEEP_SKY) {
        const p = this.eqWorld(dso.ra, dso.dec);
        if (state.mode === "outdoor" && p.y < 2) continue;
        const d = screenDist(p, 26 * fat);
        if (d != null && (!bestDso || d < bestDso.d)) bestDso = { dso, d };
      }
    }

    let bestCon: { con: Constellation; d: number } | null = null;
    if (state.showLines || state.showFigures) {
      for (const con of catalog.constellations) {
        const p = this.eqWorld(con.ra, con.dec);
        const d = screenDist(p, (state.showFigures ? 52 : 42) * fat);
        if (d != null && (!bestCon || d < bestCon.d)) bestCon = { con, d };
      }
    }

    if (bestBody && (!bestStar || bestBody.d <= bestStar.d)) return this.bodyToSelected(bestBody.body);
    if (bestStar && (!bestCon || bestStar.d < bestCon.d * 0.85) && (!bestDso || bestStar.d < bestDso.d)) {
      return this.starToSelected(catalog.stars[bestStar.i]!);
    }
    if (bestDso && (!bestCon || bestDso.d < bestCon.d)) {
      const dso = bestDso.dso;
      return {
        kind: "dso",
        id: dso.id,
        name: dso.name,
        ra: dso.ra,
        dec: dso.dec,
        info: dso.info,
        kindLabel: dso.kind,
      };
    }
    if (bestCon) {
      const con = bestCon.con;
      return {
        kind: "constellation",
        id: con.id,
        name: con.name,
        gen: con.gen,
        meaning: con.en,
        starCount: constellationStarCount(con, catalog.stars),
        ra: con.ra,
        dec: con.dec,
      };
    }
    return null;
  }

  private bodyToSelected(body: SolarBody): SelectedObject {
    const state = useSkyStore.getState();
    const date = new Date(Date.now() + state.timeOffsetHours * 3600_000);
    const lst = lstHours(date, state.lon);
    const horiz =
      state.mode === "outdoor"
        ? equatorialToAltAz(body.ra, body.dec, state.lat, lst)
        : undefined;
    return {
      kind: "body",
      id: body.id,
      name: body.name,
      mag: body.mag,
      ra: body.ra,
      dec: body.dec,
      info: body.info,
      color: body.color,
      phase: body.phase,
      alt: horiz?.alt,
      az: horiz?.az,
    };
  }

  private starToSelected(star: Star): SelectedObject {
    const state = useSkyStore.getState();
    const date = new Date(Date.now() + state.timeOffsetHours * 3600_000);
    const lst = lstHours(date, state.lon);
    const horiz =
      state.mode === "outdoor"
        ? equatorialToAltAz(star.ra, star.dec, state.lat, lst)
        : undefined;
    return {
      kind: "star",
      hip: star.hip,
      name: star.name || (star.bayer ? `${star.bayer} ${star.con ?? ""}`.trim() : `HIP ${star.hip}`),
      con: star.con,
      bayer: star.bayer,
      mag: star.mag,
      bv: star.bv,
      ra: star.ra,
      dec: star.dec,
      alt: horiz?.alt,
      az: horiz?.az,
    };
  }

  private starWorldPosition(star: Star): THREE.Vector3 {
    const i = this.catalog?.stars.indexOf(star) ?? -1;
    if (i >= 0) {
      return new THREE.Vector3(
        this.starPositions[i * 3]!,
        this.starPositions[i * 3 + 1]!,
        this.starPositions[i * 3 + 2]!,
      ).applyQuaternion(this.skyGroup.quaternion);
    }
    return this.eqWorld(star.ra, star.dec);
  }

  private eqWorld(ra: number, dec: number): THREE.Vector3 {
    const p = equatorialToCartesian(ra, dec, SKY_RADIUS);
    return new THREE.Vector3(p.x, p.y, p.z).applyQuaternion(this.skyGroup.quaternion);
  }

  private makeStarPresent(star: Star) {
    const group = new THREE.Group();
    const color = new THREE.Color().setRGB(...bvToRgb(star.bv));
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 32, 32),
      new THREE.MeshBasicMaterial({ color }),
    );
    group.add(core);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 24, 24),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    group.add(glow);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 24, 24),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    group.add(halo);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.76, 64),
      new THREE.MeshBasicMaterial({
        color: 0xc5ccd6,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.position.z = 0.02;
    group.add(ring);
    return group;
  }

  private makeConstellationPresent(con: Constellation) {
    const group = new THREE.Group();
    const art = figureFor(con);
    if (art) {
      const tex = new THREE.CanvasTexture(art.canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const aspect = art.width / art.height;
      const fig = new THREE.Mesh(
        new THREE.PlaneGeometry(2.35 * Math.max(aspect, 0.7), 2.35 / Math.max(aspect, 0.7)),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      fig.position.z = -0.08;
      group.add(fig);
    }

    const raw: THREE.Vector3[] = [];
    const pathsLocal: THREE.Vector3[][] = [];
    for (const path of con.paths) {
      const local = path.map(([ra, dec]) => {
        const p = equatorialToCartesian(ra, dec, 1);
        return new THREE.Vector3(p.x, p.y, p.z);
      });
      raw.push(...local);
      pathsLocal.push(local);
    }
    if (raw.length === 0) return group;
    const centroid = new THREE.Vector3();
    for (const p of raw) centroid.add(p);
    centroid.divideScalar(raw.length);
    const face = new THREE.Quaternion().setFromUnitVectors(
      centroid.clone().normalize(),
      new THREE.Vector3(0, 0, 1),
    );
    const oriented = raw.map((p) => p.clone().sub(centroid).applyQuaternion(face));
    let maxR = 0.001;
    for (const p of oriented) maxR = Math.max(maxR, p.length());
    const scale = 1.12 / maxR;

    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0xf2ead8,
      transparent: true,
      opacity: 0.92,
    });
    for (const path of pathsLocal) {
      if (path.length < 2) continue;
      const pts = path.map((p) =>
        p.clone().sub(centroid).applyQuaternion(face).multiplyScalar(scale),
      );
      if (pts.length === 2) {
        pts.splice(1, 0, pts[0]!.clone().lerp(pts[1]!, 0.5));
      }
      if (pts.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.018, 6, false), tubeMat);
      group.add(tube);
    }

    const starGeo = new THREE.SphereGeometry(1, 16, 16);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xfff6e4 });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffe8b8,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const seen = new Set<string>();
    for (const path of con.paths) {
      for (const [ra, dec] of path) {
        const key = `${ra}:${dec}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const p = equatorialToCartesian(ra, dec, 1);
        const v = new THREE.Vector3(p.x, p.y, p.z)
          .sub(centroid)
          .applyQuaternion(face)
          .multiplyScalar(scale);
        const m = new THREE.Mesh(starGeo, starMat);
        m.position.copy(v);
        m.scale.setScalar(0.055);
        group.add(m);
        const g = new THREE.Mesh(starGeo, glowMat);
        g.position.copy(v);
        g.scale.setScalar(0.14);
        group.add(g);
      }
    }
    return group;
  }

  private makeBodyPresent(body: SolarBody) {
    const group = new THREE.Group();
    const color = new THREE.Color().setRGB(...body.color);
    if (body.id === "moon") {
      const tex = new THREE.CanvasTexture(paintMoonPhase(body.phase, body.waxing));
      tex.colorSpace = THREE.SRGBColorSpace;
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.72, 64),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
      );
      group.add(disc);
    } else {
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(body.id === "sun" ? 0.55 : 0.42, 32, 32),
        new THREE.MeshBasicMaterial({ color }),
      );
      group.add(core);
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(body.id === "sun" ? 0.95 : 0.7, 24, 24),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      group.add(glow);
      if (body.id === "saturn") {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.55, 0.95, 64),
          new THREE.MeshBasicMaterial({
            color: 0xd9c89a,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        ring.rotation.x = 1.15;
        group.add(ring);
      }
    }
    return group;
  }

  private makeDsoPresent(dso: DeepSky) {
    const group = new THREE.Group();
    const tex = new THREE.CanvasTexture(paintDeepSky(dso));
    tex.colorSpace = THREE.SRGBColorSpace;
    const disc = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    group.add(disc);
    return group;
  }

  private updatePresent(dt: number) {
    if (!this.present) {
      this.presentGroup.visible = false;
      return;
    }
    this.presentGroup.visible = true;
    this.present.t = Math.min(1, this.present.t + dt / this.present.duration);
    const u = 1 - (1 - this.present.t) ** 3;
    const cam = this.activeCamera();
    cam.getWorldPosition(this.tmp);
    cam.getWorldQuaternion(this.tmpQ);
    this.tmp2.set(0, 0.22, -PRESENT_DISTANCE).applyQuaternion(this.tmpQ);
    this.tmp3.copy(this.tmp).add(this.tmp2);
    this.presentGroup.position.lerpVectors(this.present.from, this.tmp3, u);
    this.presentGroup.quaternion.copy(this.tmpQ);
    this.presentGroup.scale.setScalar(0.12 + 0.55 * u);
    if (this.present.spinning && this.present.inner && this.present.t >= 1) {
      this.present.inner.rotateZ(dt * 0.18);
    }
  }

  private clearPresent() {
    while (this.presentGroup.children.length) {
      const child = this.presentGroup.children.pop()!;
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
    }
    this.present = null;
  }

  private setupControllers() {
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      const rayGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1.4),
      ]);
      const ray = new THREE.Line(
        rayGeo,
        new THREE.LineBasicMaterial({ color: 0xc5ccd6, transparent: true, opacity: 0.55 }),
      );
      controller.add(ray);
      controller.addEventListener("select", () => this.onControllerSelect(controller));
      this.scene.add(controller);
      this.controllers.push(controller);
    }
  }

  private onControllerSelect(controller: THREE.Object3D) {
    controller.getWorldPosition(this.tmp);
    controller.getWorldQuaternion(this.tmpQ);
    this.tmp2.set(0, 0, -1).applyQuaternion(this.tmpQ);
    this.raycaster.set(this.tmp, this.tmp2);
    const cam = this.activeCamera();
    this.tmp3.copy(this.tmp).addScaledVector(this.tmp2, 8).project(cam);
    this.selectAt(this.tmp3.x, this.tmp3.y);
  }

  private async detectXR() {
    const xr = getXR();
    if (!xr) {
      useSkyStore.getState().setXr({ ar: false, vr: false });
      return;
    }
    const ar = await xr.isSessionSupported("immersive-ar").catch(() => false);
    const vr = await xr.isSessionSupported("immersive-vr").catch(() => false);
    useSkyStore.getState().setXr({ ar: Boolean(ar), vr: Boolean(vr) });
  }

  private resize() {
    const parent = this.canvas.parentElement;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
}

export type SkyEngineHandle = SkyEngine;
