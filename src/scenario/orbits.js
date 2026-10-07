import * as Cesium from "cesium";

// Notional orbits. Positions are computed in an Earth-fixed frame and time is
// compressed (a MEO orbit that takes ~13 h moves ~20° in the 2-minute story),
// so the geometry stays readable over Alaska for the whole scenario.

const RE = 6378137.0;
const D2R = Math.PI / 180;
const T_REF = 60; // story second at which each satellite sits at its anchor point

function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 12; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

function positionFromElements({ a, e, i, raan, argp }, M, result) {
  const E = solveKepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const u = argp + nu;
  const cO = Math.cos(raan), sO = Math.sin(raan), ci = Math.cos(i), si = Math.sin(i);
  const cu = Math.cos(u), su = Math.sin(u);
  return Cesium.Cartesian3.fromElements(
    r * (cO * cu - sO * su * ci),
    r * (sO * cu + cO * su * ci),
    r * (su * si),
    result
  );
}

// Circular orbit that passes over (lat, lon) at T_REF.
function circularThrough(latDeg, lonDeg, altKm, incDeg, ascending = true) {
  const i = incDeg * D2R;
  const phi = latDeg * D2R;
  const su = Math.sin(phi) / Math.sin(i);
  let u = Math.asin(Math.max(-1, Math.min(1, su)));
  if (!ascending) u = Math.PI - u;
  const raan = lonDeg * D2R - Math.atan2(Math.sin(u) * Math.cos(i), Math.cos(u));
  return { a: RE + altKm * 1000, e: 0, i, raan, argp: 0, M0: u };
}

function molniya({ apogeeLonDeg, perigeeAltKm, apogeeAltKm }) {
  const rp = RE + perigeeAltKm * 1000;
  const ra = RE + apogeeAltKm * 1000;
  const i = 63.4 * D2R;
  // With argp = 270°, apogee is at argument of latitude 90° → longitude raan + 90°
  return {
    a: (rp + ra) / 2,
    e: (ra - rp) / (ra + rp),
    i,
    raan: (apogeeLonDeg - 90) * D2R,
    argp: 270 * D2R,
    M0: Math.PI,
  };
}

export const SATELLITES = [
  {
    id: "gps",
    name: "GPS III SV-08",
    role: "Friendly PNT",
    color: "#56D6B0",
    elements: circularThrough(47, -156, 20200, 55, true),
    rateDegPerSec: 0.16,
  },
  {
    id: "bds",
    name: "BDS-3 M-X",
    role: "BeiDou MEO (notional)",
    color: "#C9D3DC",
    elements: circularThrough(40, -171, 21528, 55, false),
    rateDegPerSec: 0.15,
  },
  {
    id: "sbirsGeo",
    name: "SBIRS GEO",
    role: "Missile warning / sensing",
    color: "#A89BFF",
    elements: { a: RE + 35786e3, e: 0, i: 0, raan: 0, argp: 0, M0: -138 * D2R },
    rateDegPerSec: 0, // geostationary: fixed over the equator
  },
  {
    id: "sbirsHeo",
    name: "SBIRS HEO",
    role: "Arctic coverage (Molniya)",
    color: "#A89BFF",
    elements: molniya({ apogeeLonDeg: -125, perigeeAltKm: 1100, apogeeAltKm: 39000 }),
    rateDegPerSec: 0.07,
  },
];

export function satPosition(sat, t, result) {
  const M = sat.elements.M0 + sat.rateDegPerSec * D2R * (t - T_REF);
  return positionFromElements(sat.elements, M, result);
}

// Full orbit polyline for drawing the ring.
export function orbitRing(sat, samples = 240) {
  const pts = [];
  for (let k = 0; k <= samples; k++) {
    pts.push(positionFromElements(sat.elements, (k / samples) * 2 * Math.PI));
  }
  return pts;
}

// Points along the orbit around the current position (for the Kalman track arc).
export function orbitArc(sat, t, spanDeg, samples, perturb) {
  const pts = [];
  const Mc = sat.elements.M0 + sat.rateDegPerSec * D2R * (t - T_REF);
  for (let k = 0; k <= samples; k++) {
    const f = k / samples;
    const M = Mc + (f - 0.75) * spanDeg * D2R; // 3/4 of the arc behind, 1/4 predicted ahead
    const p = positionFromElements(sat.elements, M);
    if (perturb) perturb(p, f, k);
    pts.push(p);
  }
  return pts;
}
