import * as Cesium from "cesium";
import { FlowLineMaterialProperty } from "../cesium/FlowLineMaterial";
import { ICONS } from "../cesium/icons";
import { SATELLITES, satPosition, orbitRing, orbitArc } from "./orbits";
import { DURATION, PHASES, phaseIndexAt, covarianceKm, TRACK_UUID } from "./timeline";

export const COLORS = {
  gps: "#56D6B0",
  jam: "#FF4D5E",
  sensor: "#A89BFF",
  data: "#7FE3FF",
  intel: "#F4F7FA",
  amber: "#FFB547",
  friendly: "#8CC8FF",
  ok: "#3DD68C",
  neutral: "#C9D3DC",
};

export const SITES = {
  eielson: { name: "Eielson AFB", lon: -147.1, lat: 64.665 },
  battery: { name: "FIRES BTY A", lon: -145.85, lat: 63.8 },
  mdp: { name: "MDP", lon: -149.19, lat: 64.29 },
  alcom: { name: "ALCOM · JBER", lon: -149.8, lat: 61.25 },
  norad: { name: "NORAD-USNORTHCOM", lon: -104.7, lat: 38.82 },
  indopacom: { name: "INDOPACOM", lon: -157.9, lat: 21.39 },
  hub: { name: "VALIDATED INTEL HUB", lon: -152.6, lat: 62.4, h: 160000 },
  jamCenter: { lon: -146.2, lat: 63.85 },
};

// F-16 route: [story seconds, lon, lat, altitude m]
const ROUTE = [
  [0, -147.1, 64.665, 300],
  [12, -146.55, 64.45, 6000],
  [30, -145.55, 64.1, 7500],
  [50, -145.05, 63.65, 7500],
  [70, -145.7, 63.3, 7500],
  [90, -146.9, 63.35, 7500],
  [110, -147.6, 63.75, 7500],
  [120, -147.75, 64.0, 7500],
];

const { Cartesian3, Cartesian2, JulianDate, Color } = Cesium;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const C = (hex, a = 1) => Color.fromCssColorString(hex).withAlpha(a);
const siteP = (s) => Cartesian3.fromDegrees(s.lon, s.lat, s.h || 0);

// Ramp 0→1 between a and b.
const ramp = (t, a, b) => clamp01((t - a) / (b - a));

// Raised arc between two points (for ground-to-ground and air-to-ground links).
function arcPoints(a, b, peak, n = 40) {
  const ca = Cesium.Cartographic.fromCartesian(a);
  const cb = Cesium.Cartographic.fromCartesian(b);
  const geo = new Cesium.EllipsoidGeodesic(ca, cb);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const c = geo.interpolateUsingFraction(f);
    const h = ca.height + (cb.height - ca.height) * f + peak * Math.sin(Math.PI * f);
    pts.push(Cartesian3.fromRadians(c.longitude, c.latitude, h));
  }
  return pts;
}

// Deterministic pseudo-random for reproducible "measurement noise".
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function createScenario(viewer, { onTick }) {
  const scene = viewer.scene;
  const E = viewer.entities;
  const start = JulianDate.fromIso8601("2026-09-26T19:00:00Z");
  const clock = viewer.clock;
  clock.startTime = start.clone();
  clock.stopTime = JulianDate.addSeconds(start, DURATION, new JulianDate());
  clock.currentTime = start.clone();
  clock.clockRange = Cesium.ClockRange.CLAMPED;
  clock.multiplier = 1;
  clock.shouldAnimate = false;

  const T = (time) => JulianDate.secondsDifference(time, start);
  const at = (t) => JulianDate.addSeconds(start, t, new JulianDate());
  const cb = (fn) => new Cesium.CallbackProperty(fn, false);

  // Entities with a visibility window [t0, t1) in story seconds.
  const windows = [];
  const add = (opts, t0 = -1, t1 = Infinity) => {
    const e = E.add(opts);
    windows.push([e, t0, t1]);
    return e;
  };

  const sat = Object.fromEntries(SATELLITES.map((s) => [s.id, s]));
  const satP = (id, t) => satPosition(sat[id], t, new Cartesian3());

  // ---------- F-16 ----------
  const jetPos = new Cesium.SampledPositionProperty();
  jetPos.setInterpolationOptions({
    interpolationDegree: 3,
    interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
  });
  ROUTE.forEach(([t, lon, lat, h]) => jetPos.addSample(at(t), Cartesian3.fromDegrees(lon, lat, h)));
  jetPos.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
  jetPos.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
  const jetP = (t) => jetPos.getValue(at(Math.min(DURATION, Math.max(0, t))), new Cartesian3());

  // ---------- Status-driven colors ----------
  const bdsHex = (t) => (t >= 58 ? COLORS.jam : t >= 32 ? COLORS.amber : COLORS.neutral);
  const jetHex = (t) =>
    t >= 106 ? COLORS.ok : t >= 94 ? COLORS.amber : t >= 14 ? COLORS.jam : COLORS.intel;
  const btyHex = (t) =>
    t >= 106 ? COLORS.ok : t >= 96 ? COLORS.amber : t >= 15 ? COLORS.jam : COLORS.friendly;

  const labelBase = {
    font: '600 14px "Barlow Condensed", "Arial Narrow", sans-serif',
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    outlineColor: C("#05080B", 0.95),
    outlineWidth: 4,
    horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
    verticalOrigin: Cesium.VerticalOrigin.CENTER,
    pixelOffset: new Cartesian2(16, 0),
  };
  const onTop = { disableDepthTestDistance: Number.POSITIVE_INFINITY };

  // ---------- Satellites and orbit rings ----------
  for (const s of SATELLITES) {
    const isBds = s.id === "bds";
    add({
      id: s.id,
      name: s.name,
      position: cb((time, r) => satPosition(s, T(time), r || new Cartesian3())),
      billboard: {
        image: ICONS.satellite,
        scale: isBds ? cb((time) => (T(time) >= 58 ? 0.62 : 0.5)) : 0.5,
        color: isBds ? cb((time) => C(bdsHex(T(time)))) : C(s.color),
      },
      label: {
        ...labelBase,
        text: isBds
          ? cb((time) => {
              const t = T(time);
              return t >= 58 ? `${s.name} · HOSTILE` : t >= 32 ? `${s.name} · ANOMALY` : `${s.name} (BeiDou)`;
            })
          : s.name,
        fillColor: isBds ? cb((time) => C(bdsHex(T(time)))) : C(s.color),
      },
    });
    add({
      polyline: {
        positions: orbitRing(s),
        width: isBds ? 1.6 : 1.2,
        arcType: Cesium.ArcType.NONE,
        material: isBds
          ? new Cesium.ColorMaterialProperty(cb((time) => C(bdsHex(T(time)), T(time) >= 58 ? 0.6 : 0.3)))
          : C(s.color, 0.28),
      },
    });
  }

  // ---------- F-16 entity ----------
  add({
    id: "viper11",
    name: "VIPER 11 (F-16)",
    position: jetPos,
    billboard: {
      image: ICONS.jet,
      scale: 0.42,
      color: C(COLORS.intel),
      alignedAxis: cb((time) => {
        const t = Math.min(DURATION - 1, Math.max(0, T(time)));
        const v = Cartesian3.subtract(jetP(t + 0.5), jetP(t), new Cartesian3());
        return Cartesian3.normalize(v, v);
      }),
      ...onTop,
    },
    label: { ...labelBase, text: "VIPER 11 · F-16", fillColor: cb((time) => C(jetHex(T(time)))), ...onTop },
    path: {
      leadTime: 0,
      trailTime: 40,
      width: 2,
      resolution: 1,
      material: C(COLORS.intel, 0.45),
    },
  });

  // ---------- Ground and C2 sites ----------
  const site = (key, image, hex, extra = {}) =>
    add({
      id: key,
      name: SITES[key].name,
      position: siteP(SITES[key]),
      billboard: { image, scale: 0.36, color: C(hex), ...onTop },
      label: { ...labelBase, text: SITES[key].name, fillColor: C(hex), ...onTop },
      ...extra,
    });
  site("eielson", ICONS.node, "#7F95A6");
  site("mdp", ICONS.node, COLORS.data);
  site("alcom", ICONS.command, COLORS.friendly);
  site("norad", ICONS.command, COLORS.friendly);
  site("indopacom", ICONS.command, COLORS.friendly);
  const bty = site("battery", ICONS.battery, COLORS.friendly);
  bty.billboard.color = cb((time) => C(btyHex(T(time))));
  bty.label.fillColor = cb((time) => C(btyHex(T(time))));
  add({
    id: "hub",
    name: SITES.hub.name,
    position: siteP(SITES.hub),
    billboard: { image: ICONS.hub, scale: 0.5, color: C(COLORS.intel), ...onTop },
    label: { ...labelBase, text: SITES.hub.name, fillColor: C(COLORS.intel), ...onTop },
  }, 68);

  // ---------- Flow-line helper ----------
  const flow = ({ from, to, color, alpha, t0 = -1, t1 = Infinity, width = 2, arc = 0, ...mat }) =>
    add(
      {
        polyline: {
          positions: cb((time) => {
            const t = T(time);
            const a = from(t), b = to(t);
            return arc ? arcPoints(a, b, arc) : [a, b];
          }),
          width,
          arcType: Cesium.ArcType.NONE,
          material: new FlowLineMaterialProperty({
            clock: T,
            color: (time) => C(typeof color === "function" ? color(T(time)) : color, alpha(T(time))),
            ...mat,
          }),
        },
      },
      t0,
      t1
    );

  const P = {
    gps: (t) => satP("gps", t),
    bds: (t) => satP("bds", t),
    heo: (t) => satP("sbirsHeo", t),
    geo: (t) => satP("sbirsGeo", t),
    jet: jetP,
    bty: () => siteP(SITES.battery),
    mdp: () => siteP(SITES.mdp),
    hub: () => siteP(SITES.hub),
    alcom: () => siteP(SITES.alcom),
    norad: () => siteP(SITES.norad),
    indopacom: () => siteP(SITES.indopacom),
  };

  // 1. GPS III signal to users (weakens while jammed, recovers with M-code).
  const gpsAlpha = (t) => {
    if (t < 12) return 0.85;
    if (t < 94) return 0.85 - 0.72 * ramp(t, 12, 16);
    return 0.13 + 0.82 * ramp(t, 94, 104);
  };
  flow({ from: P.gps, to: P.jet, color: COLORS.gps, alpha: gpsAlpha, width: 3.5, speed: 0.9, repeat: 5, base: 0.6 });
  flow({ from: P.gps, to: P.bty, color: COLORS.gps, alpha: gpsAlpha, width: 3.5, speed: 0.9, repeat: 5, base: 0.6 });

  // 2. Jamming: beam fan from the BeiDou satellite plus ground ripples.
  const jamC = siteP(SITES.jamCenter);
  const jamAlpha = (t) => 0.85 * ramp(t, 10, 13) * (t >= 106 ? 0.5 : 1);
  const fanTargets = [];
  for (let k = 0; k < 8; k++) {
    const brg = (k / 8) * 2 * Math.PI;
    const dLat = (260e3 / 111e3) * Math.cos(brg);
    const dLon = ((260e3 / 111e3) * Math.sin(brg)) / Math.cos((SITES.jamCenter.lat * Math.PI) / 180);
    fanTargets.push(Cartesian3.fromDegrees(SITES.jamCenter.lon + dLon, SITES.jamCenter.lat + dLat, 0));
  }
  fanTargets.forEach((p) =>
    flow({ from: P.bds, to: () => p, color: COLORS.jam, alpha: (t) => jamAlpha(t) * 0.7, t0: 10, width: 2, speed: 1.6, repeat: 10, duty: 3, base: 0.45 })
  );
  const jamToUser = (t) => jamAlpha(t) * (t >= 94 ? 0.35 : 1);
  flow({ from: P.bds, to: P.jet, color: COLORS.jam, alpha: jamToUser, t0: 10, width: 3.5, speed: 1.6, repeat: 10, duty: 3, base: 0.6 });
  flow({ from: P.bds, to: P.bty, color: COLORS.jam, alpha: jamToUser, t0: 10, width: 3.5, speed: 1.6, repeat: 10, duty: 3, base: 0.6 });

  const intensity = (t) => ramp(t, 10, 13) * (t >= 106 ? 0.45 : 1);
  for (let k = 0; k < 3; k++) {
    const frac = (t) => (((t * 0.33 + k / 3) % 1) + 1) % 1;
    const radius = cb((time) => 15e3 + frac(T(time)) * 420e3);
    add(
      {
        position: jamC,
        ellipse: {
          semiMajorAxis: radius,
          semiMinorAxis: radius,
          height: 0,
          granularity: Cesium.Math.toRadians(1.5),
          material: new Cesium.ColorMaterialProperty(
            cb((time) => C(COLORS.jam, (1 - frac(T(time))) * 0.28 * intensity(T(time))))
          ),
        },
      },
      10
    );
  }
  add(
    {
      position: jamC,
      ellipse: {
        semiMajorAxis: 440e3,
        semiMinorAxis: 440e3,
        height: 0,
        material: new Cesium.ColorMaterialProperty(cb((time) => C(COLORS.jam, 0.07 * intensity(T(time))))),
        outline: true,
        outlineColor: C(COLORS.jam, 0.7),
      },
      label: {
        ...labelBase,
        text: "GNSS INTERFERENCE AREA",
        fillColor: C(COLORS.jam),
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cartesian2(0, 60),
        ...onTop,
      },
    },
    12
  );

  // Pulse ring billboards (expanding, fading).
  const pulse = (position, hex, t0, t1, period = 1.6, maxScale = 1.6) =>
    add(
      {
        position,
        billboard: {
          image: ICONS.ring,
          scale: cb((time) => 0.3 + (((T(time) - t0) % period) / period) * maxScale),
          color: cb((time) => C(hex, 1 - ((T(time) - t0) % period) / period)),
          ...onTop,
        },
      },
      t0,
      t1
    );

  // 3. Pilot anomaly report: F-16 → MDP.
  pulse(jetPos, COLORS.amber, 22, 30);
  flow({ from: P.jet, to: P.mdp, color: COLORS.amber, alpha: () => 0.95, t0: 22, t1: 32, width: 4, arc: 70e3, speed: 1.4, repeat: 3, duty: 4, base: 0.55 });

  // 4. SBIRS coverage dome over the Arctic and sensor lines to the anomaly.
  const domeCenter = Cartesian3.fromDegrees(-150, 62, 0);
  add(
    {
      position: domeCenter,
      orientation: Cesium.Transforms.headingPitchRollQuaternion(domeCenter, new Cesium.HeadingPitchRoll(0, 0, 0)),
      ellipsoid: {
        radii: new Cartesian3(26e6, 26e6, 26e6),
        maximumCone: Cesium.Math.PI_OVER_TWO,
        slicePartitions: 48,
        stackPartitions: 24,
        material: new Cesium.GridMaterialProperty({
          color: cb((time) => {
            const t = T(time);
            const a = 0.15 + 0.45 * ramp(t, 30, 33) * (0.75 + 0.25 * Math.sin(t * 4)) - 0.5 * ramp(t, 54, 58);
            return C(COLORS.sensor, Math.max(0, a));
          }),
          cellAlpha: 0.025,
          lineCount: new Cartesian2(36, 14),
          lineThickness: new Cartesian2(1.2, 1.2),
        }),
      },
    },
    30,
    58
  );
  const sensorAlpha = (t) => 0.9 * ramp(t, 30, 32) * (t >= 58 ? 0.4 : 1);
  flow({ from: P.heo, to: P.bds, color: COLORS.sensor, alpha: sensorAlpha, t0: 30, t1: 92, width: 2.5, speed: 0.8, repeat: 6, base: 0.5 });
  flow({ from: P.geo, to: P.bds, color: COLORS.sensor, alpha: sensorAlpha, t0: 30, t1: 92, width: 2.5, speed: 0.8, repeat: 6, base: 0.5 });

  const bdsPosProp = cb((time, r) => satPosition(sat.bds, T(time), r || new Cartesian3()));
  add(
    {
      position: bdsPosProp,
      billboard: {
        image: ICONS.diamond,
        scale: cb((time) => 0.55 + 0.15 * Math.sin(T(time) * 6)),
        color: C(COLORS.amber),
      },
    },
    32,
    58
  );

  // 5. Track: detections, Kalman track arc, covariance ellipsoid.
  const r = rng(7);
  for (let k = 0; k < 10; k++) {
    const tk = 32 + k * 3;
    const truth = satP("bds", tk);
    const mag = (covarianceKm(Math.max(42, tk)) ?? 2500) * 1000 * 0.6;
    const n = Cartesian3.normalize(new Cartesian3(r() - 0.5, r() - 0.5, r() - 0.5), new Cartesian3());
    const p = Cartesian3.add(truth, Cartesian3.multiplyByScalar(n, mag * (0.3 + 0.7 * r()), n), new Cartesian3());
    add({ position: p, point: { pixelSize: 6, color: C(COLORS.amber), outlineColor: C("#05080B"), outlineWidth: 1.5 } }, tk, 92);
  }

  const trackHex = (t) => (t >= 58 ? COLORS.jam : COLORS.amber);
  add(
    {
      polyline: {
        positions: cb((time) => {
          const t = T(time);
          const A = (covarianceKm(t) ?? 0) * 1000 * 0.5;
          return orbitArc(sat.bds, t, 34, 90, (p, f, k) => {
            const w = Math.sin(k * 0.37 + t * 0.9) * 0.6 + Math.sin(k * 0.13 + 1.3) * 0.4;
            const up = Cartesian3.normalize(p, new Cartesian3());
            Cartesian3.add(p, Cartesian3.multiplyByScalar(up, A * w, up), p);
          });
        }),
        width: 3,
        arcType: Cesium.ArcType.NONE,
        material: new FlowLineMaterialProperty({
          clock: T,
          color: (time) => C(trackHex(T(time)), 0.95),
          speed: 0.5,
          repeat: 3,
          duty: 2,
          base: 0.45,
        }),
      },
    },
    42
  );

  const orient = (t) => {
    const p = satP("bds", t);
    const x = Cartesian3.normalize(Cartesian3.subtract(satP("bds", t + 0.5), p, new Cartesian3()), new Cartesian3());
    const up = Cartesian3.normalize(p, new Cartesian3());
    const y = Cartesian3.normalize(Cartesian3.cross(up, x, new Cartesian3()), new Cartesian3());
    const z = Cartesian3.cross(x, y, new Cartesian3());
    const m = new Cesium.Matrix3(x.x, y.x, z.x, x.y, y.y, z.y, x.z, y.z, z.z);
    return Cesium.Quaternion.fromRotationMatrix(m);
  };
  add(
    {
      position: bdsPosProp,
      orientation: cb((time) => orient(T(time))),
      ellipsoid: {
        radii: cb((time) => {
          const s = (covarianceKm(T(time)) ?? 100) * 1000;
          return new Cartesian3(s, s * 0.45, s * 0.3);
        }),
        slicePartitions: 24,
        stackPartitions: 16,
        subdivisions: 48,
        material: new Cesium.ColorMaterialProperty(cb((time) => C(trackHex(T(time)), 0.16))),
        outline: true,
        outlineColor: cb((time) => C(trackHex(T(time)), 0.55)),
      },
      label: {
        ...labelBase,
        text: cb((time) => {
          const t = T(time);
          const s = Math.round(covarianceKm(t) ?? 0);
          return `TRK ${TRACK_UUID.slice(0, 8)}  σ ${s} km`;
        }),
        font: '500 12px "IBM Plex Mono", monospace',
        fillColor: cb((time) => C(trackHex(T(time)))),
        pixelOffset: new Cartesian2(16, 20),
      },
    },
    42
  );

  // 6. Identification: reticle + hostile pulse.
  add(
    {
      position: bdsPosProp,
      billboard: {
        image: ICONS.reticle,
        scale: 0.8,
        rotation: cb((time) => T(time) * 0.4),
        color: C(COLORS.jam),
      },
    },
    58
  );
  pulse(bdsPosProp, COLORS.jam, 58, Infinity, 1.4, 2.2);

  // 7. Data flow: sensors → MDP → hub → commanders.
  const pkt = { color: COLORS.data, width: 3.5, speed: 1.5, repeat: 3, duty: 4, base: 0.45 };
  const on = (a, b) => (t) => 0.95 * ramp(t, a, a + 1.5) * (1 - ramp(t, b - 1, b));
  flow({ ...pkt, from: P.heo, to: P.mdp, alpha: on(68, 82), t0: 68, t1: 82 });
  flow({ ...pkt, from: P.geo, to: P.mdp, alpha: on(68, 82), t0: 68, t1: 82 });
  flow({ ...pkt, from: P.jet, to: P.mdp, alpha: on(68, 82), t0: 68, t1: 82, arc: 60e3 });
  flow({ ...pkt, from: P.mdp, to: P.hub, alpha: on(72, 82), t0: 72, t1: 82, arc: 40e3 });
  flow({ ...pkt, from: P.hub, to: P.alcom, alpha: on(76, 82), t0: 76, t1: 82, arc: 60e3 });
  flow({ ...pkt, from: P.hub, to: P.norad, alpha: on(76, 82), t0: 76, t1: 82, arc: 500e3 });
  flow({ ...pkt, from: P.hub, to: P.indopacom, alpha: on(76, 82), t0: 76, t1: 82, arc: 500e3 });

  // 8. Simultaneous push from the hub to all recipients.
  const push = { color: COLORS.intel, width: 3.5, speed: 2, repeat: 2, duty: 4, base: 0.45 };
  const pushAlpha = (t) => ramp(t, 82, 83) * (t >= 92 ? 0.3 : 1);
  flow({ ...push, from: P.hub, to: P.alcom, alpha: pushAlpha, t0: 82, arc: 60e3 });
  flow({ ...push, from: P.hub, to: P.norad, alpha: pushAlpha, t0: 82, arc: 500e3 });
  flow({ ...push, from: P.hub, to: P.indopacom, alpha: pushAlpha, t0: 82, arc: 500e3 });
  flow({ ...push, from: P.hub, to: P.jet, alpha: pushAlpha, t0: 82 });
  flow({ ...push, from: P.hub, to: P.bty, alpha: pushAlpha, t0: 82 });
  flow({ ...push, from: P.hub, to: P.mdp, alpha: pushAlpha, t0: 82 });
  for (let k = 0; k < 3; k++) pulse(siteP(SITES.hub), COLORS.intel, 82 + k * 0.5, 92, 1.5, 2.4);

  // 9. Mitigation: M-code + CRPA null toward the jammer.
  const shield = (position, labelText) =>
    add(
      {
        position,
        billboard: {
          image: ICONS.shield,
          scale: 0.95,
          rotation: cb((time) => -T(time) * 0.8),
          color: cb((time) => C(T(time) >= 106 ? COLORS.ok : COLORS.gps)),
          ...onTop,
        },
        label: {
          ...labelBase,
          text: labelText,
          font: '500 11px "IBM Plex Mono", monospace',
          fillColor: C(COLORS.gps),
          pixelOffset: new Cartesian2(16, 18),
          ...onTop,
        },
      },
      94
    );
  shield(jetPos, "M-CODE · NULL");
  shield(siteP(SITES.battery), "M-CODE · NULL");
  const nullLine = (fromFn) =>
    add(
      {
        polyline: {
          positions: cb((time) => {
            const t = T(time);
            const a = fromFn(t);
            const d = Cartesian3.normalize(Cartesian3.subtract(P.bds(t), a, new Cartesian3()), new Cartesian3());
            return [a, Cartesian3.add(a, Cartesian3.multiplyByScalar(d, 120e3, d), new Cartesian3())];
          }),
          width: 4,
          arcType: Cesium.ArcType.NONE,
          material: new Cesium.PolylineDashMaterialProperty({ color: C(COLORS.gps), dashLength: 10 }),
        },
      },
      94,
      106
    );
  nullLine(P.jet);
  nullLine(P.bty);

  // 10. Restored: green confirmation pulses.
  pulse(jetPos, COLORS.ok, 106, 114, 1.6, 1.8);
  pulse(siteP(SITES.battery), COLORS.ok, 106, 114, 1.6, 1.8);

  // ---------- Camera shots ----------
  const shotDefs = {
    region: (t) => ({
      pts: [P.jet(t), P.bty(), P.mdp(), siteP(SITES.eielson), jamC, P.alcom(), P.hub()],
      hpr: new Cesium.HeadingPitchRange(Cesium.Math.toRadians(200), Cesium.Math.toRadians(-42), 0),
      scale: 7,
    }),
    // Low, looking south-west from behind Alaska so the beams come down out of the sky.
    jam: () => ({
      pts: [jamC],
      radius: 5e5,
      hpr: new Cesium.HeadingPitchRange(Cesium.Math.toRadians(215), Cesium.Math.toRadians(-14), 0),
      scale: 5,
    }),
    space: (t) => ({
      pts: [P.gps(t), P.bds(t), P.heo(t), P.geo(t), jamC],
      hpr: new Cesium.HeadingPitchRange(Cesium.Math.toRadians(20), Cesium.Math.toRadians(-25), 0),
      scale: 2.0,
    }),
    jammer: (t) => ({
      pts: [P.bds(t)],
      radius: 3.2e6,
      hpr: new Cesium.HeadingPitchRange(Cesium.Math.toRadians(40), Cesium.Math.toRadians(-30), 0),
      scale: 3.2,
    }),
    network: (t) => ({
      pts: [P.hub(), P.norad(), P.indopacom(), P.mdp(), P.jet(t)],
      hpr: new Cesium.HeadingPitchRange(Cesium.Math.toRadians(-5), Cesium.Math.toRadians(-88), 0),
      scale: 4.4,
    }),
  };

  function goToShot(name, duration = 2.5) {
    const d = shotDefs[name](T(clock.currentTime));
    const sphere = Cesium.BoundingSphere.fromPoints(d.pts);
    if (d.radius) sphere.radius = d.radius;
    const hpr = Cesium.HeadingPitchRange.clone(d.hpr);
    hpr.range = Math.max(8e5, sphere.radius * d.scale);
    viewer.camera.flyToBoundingSphere(sphere, { offset: hpr, duration });
  }

  // ---------- Tick loop ----------
  let lastPhase = -1;
  let autoCam = true;
  const removeTick = clock.onTick.addEventListener((c) => {
    const t = T(c.currentTime);
    for (const [e, t0, t1] of windows) {
      const v = t >= t0 && t < t1;
      if (e.show !== v) e.show = v;
    }
    const pi = phaseIndexAt(t);
    if (pi !== lastPhase) {
      if (autoCam && lastPhase !== -1 && clock.shouldAnimate) goToShot(PHASES[pi].shot, 2.8);
      lastPhase = pi;
    }
    if (t >= DURATION && clock.shouldAnimate) clock.shouldAnimate = false;
    onTick?.(t, clock.shouldAnimate);
  });

  goToShot("space", 0);

  return {
    play() {
      if (T(clock.currentTime) >= DURATION - 0.05) this.seek(0);
      clock.shouldAnimate = true;
    },
    pause() {
      clock.shouldAnimate = false;
    },
    seek(t) {
      t = Math.min(DURATION, Math.max(0, t));
      clock.currentTime = at(t);
      const pi = phaseIndexAt(t);
      if (autoCam && pi !== lastPhase) goToShot(PHASES[pi].shot, 1.2);
      lastPhase = pi;
    },
    setSpeed(x) {
      clock.multiplier = x;
    },
    setAutoCamera(v) {
      autoCam = v;
      if (v) goToShot(PHASES[phaseIndexAt(T(clock.currentTime))].shot, 1.5);
    },
    shot: goToShot,
    destroy() {
      removeTick();
    },
  };
}
