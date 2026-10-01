export const STAR_VERTEX = /* glsl */ `
attribute float aMag;
attribute float aPhase;
attribute float aBv;
uniform float uTime;
uniform float uPixelRatio;
uniform float uMagLimit;
uniform float uTwinkle;
uniform float uDim;
uniform float uHorizonClip;
varying vec3 vColor;
varying float vAlpha;
varying float vSpike;

vec3 bvToColor(float bv) {
  float t = clamp(bv, -0.4, 2.0);
  vec3 c = vec3(1.0);
  if (t < 0.0) {
    float u = (t + 0.4) / 0.4;
    c = vec3(0.72 + 0.28 * u, 0.84 + 0.16 * u, 1.0);
  } else if (t < 0.5) {
    float u = t / 0.5;
    c = vec3(0.93 + 0.07 * u, 0.95 + 0.03 * u, 1.0 - 0.16 * u);
  } else if (t < 1.2) {
    float u = (t - 0.5) / 0.7;
    c = vec3(1.0, 0.98 - 0.28 * u, 0.84 - 0.5 * u);
  } else {
    float u = (t - 1.2) / 0.8;
    c = vec3(1.0, 0.70 - 0.2 * u, 0.34 - 0.12 * u);
  }
  return c;
}

void main() {
  if (aMag > uMagLimit + 0.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    vColor = vec3(0.0);
    vSpike = 0.0;
    return;
  }
  vec4 world = modelMatrix * vec4(position, 1.0);
  float horizon = 1.0;
  float air = 1.0;
  if (uHorizonClip > 0.5) {
    horizon = smoothstep(-6.0, 10.0, world.y);
    air = smoothstep(-2.0, 32.0, world.y);
  }
  float tw = 1.0;
  if (uTwinkle > 0.5) {
    float low = uHorizonClip > 0.5 ? (1.0 - air) * (1.0 - air) : 0.28;
    float amp = mix(0.04, 0.42, low);
    float s1 = sin(uTime * (0.85 + aPhase * 2.6) + aPhase * 6.2831853);
    float s2 = sin(uTime * (0.21 + aPhase * 0.8) + aPhase * 3.1);
    tw = (1.0 - amp * 0.55) + amp * 0.55 * s1;
    tw *= 0.93 + 0.07 * s2;
    float see = low * 2.4;
    world.x += sin(uTime * 1.65 + aPhase * 41.0) * see;
    world.z += cos(uTime * 1.28 + aPhase * 23.0) * see;
  }
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  float bright = mix(34.0, 1.05, smoothstep(-1.5, 6.2, aMag));
  float dist = max(0.12, -mvPosition.z);
  gl_PointSize = clamp(bright * tw * uPixelRatio * (140.0 / dist), 1.0, 42.0);
  vec3 col = bvToColor(aBv);
  vColor = mix(col * vec3(1.0, 0.72, 0.48), col, air);
  float magFade = 1.0 - smoothstep(uMagLimit - 0.7, uMagLimit + 0.05, aMag);
  vAlpha = horizon * tw * magFade * mix(1.0, 0.07, uDim) * mix(0.28, 1.0, air);
  vSpike = (1.0 - smoothstep(0.2, 2.4, aMag)) * air;
}
`;

export const STAR_FRAGMENT = /* glsl */ `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
varying float vSpike;

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = dot(p, p);
  if (r > 1.0) discard;
  float core = exp(-r * 11.0);
  float halo = exp(-r * 2.1) * (0.16 + 0.28 * vSpike);
  float spike = 0.0;
  if (vSpike > 0.04) {
    vec2 a = abs(p);
    float cross = exp(-min(a.x, a.y) * 36.0) * exp(-max(a.x, a.y) * 1.35);
    spike = cross * vSpike * 0.62;
  }
  float glow = core + halo + spike;
  gl_FragColor = vec4(vColor * glow, glow * vAlpha);
}
`;

export const LINE_VERTEX = /* glsl */ `
attribute vec3 aOther;
attribute float aSide;
uniform float uHorizonClip;
uniform float uDim;
uniform vec2 uResolution;
uniform float uWidth;
varying float vAlpha;
varying float vAcross;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec4 other = modelMatrix * vec4(aOther, 1.0);
  float horizon = 1.0;
  if (uHorizonClip > 0.5) {
    horizon = smoothstep(-6.0, 18.0, world.y);
  }
  vAlpha = horizon * mix(0.9, 0.07, uDim);
  vAcross = aSide;
  vec4 clip = projectionMatrix * viewMatrix * world;
  vec4 clipO = projectionMatrix * viewMatrix * other;
  vec2 dir = clipO.xy / max(clipO.w, 0.0001) - clip.xy / max(clip.w, 0.0001);
  float len = length(dir);
  vec2 perp = len < 0.00001 ? vec2(0.0, 1.0) : vec2(-dir.y, dir.x) / len;
  clip.xy += perp * aSide * uWidth * (2.0 / max(uResolution, vec2(1.0))) * clip.w;
  gl_Position = clip;
}
`;

export const LINE_FRAGMENT = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
varying float vAlpha;
varying float vAcross;
void main() {
  float core = exp(-vAcross * vAcross * 7.5);
  float halo = exp(-vAcross * vAcross * 1.35) * 0.38;
  float w = core + halo;
  gl_FragColor = vec4(uColor, vAlpha * w);
}
`;

export const FIGURE_VERTEX = /* glsl */ `
uniform float uHorizonClip;
uniform float uDim;
uniform float uHighlight;
varying vec2 vUv;
varying float vAlpha;

void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  float horizon = 1.0;
  if (uHorizonClip > 0.5) {
    horizon = smoothstep(-4.0, 18.0, world.y);
  }
  vAlpha = horizon * mix(mix(0.82, 0.08, uDim), 1.0, uHighlight);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const FIGURE_FRAGMENT = /* glsl */ `
precision mediump float;
uniform sampler2D uMap;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.02) discard;
  gl_FragColor = vec4(t.rgb, t.a * vAlpha);
}
`;

export const DOME_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const DOME_FRAGMENT = /* glsl */ `
precision mediump float;
varying vec3 vWorld;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
void main() {
  vec3 n = normalize(vWorld);
  float h = clamp(n.y, -1.0, 1.0);
  float alt = asin(h);
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));
  col = mix(col, uZenith * 0.55, smoothstep(0.35, 0.92, h));
  float limb = exp(-pow((alt - 0.07) * 7.5, 2.0));
  col += uGlow * limb * 0.85;
  float air = exp(-pow((alt - 0.22) * 5.5, 2.0));
  col += vec3(0.10, 0.14, 0.18) * air;
  float below = smoothstep(0.012, -0.08, h);
  col = mix(col, vec3(0.012, 0.014, 0.018), below);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const HAZE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const HAZE_FRAGMENT = /* glsl */ `
precision mediump float;
varying vec2 vUv;
void main() {
  float t = vUv.y;
  float band = smoothstep(0.02, 0.28, t) * (1.0 - smoothstep(0.42, 0.96, t));
  vec3 col = mix(vec3(0.22, 0.28, 0.36), vec3(0.55, 0.62, 0.70), smoothstep(0.1, 0.45, t));
  gl_FragColor = vec4(col, band * 0.42);
}
`;

export const MILKY_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const MILKY_FRAGMENT = /* glsl */ `
precision mediump float;
uniform sampler2D uMap;
uniform float uHorizonClip;
uniform float uDim;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float horizon = 1.0;
  if (uHorizonClip > 0.5) {
    horizon = smoothstep(-4.0, 48.0, vWorld.y);
  }
  float a = t.a * horizon * mix(1.0, 0.18, uDim);
  if (a < 0.004) discard;
  gl_FragColor = vec4(t.rgb, a);
}
`;
