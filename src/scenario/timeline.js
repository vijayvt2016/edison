// Scenario script. Everything on screen is a pure function of story time t (seconds),
// so play, pause, scrub and restart always show a consistent picture.

export const DURATION = 120;

export const PHASES = [
  {
    id: "nominal",
    start: 0,
    title: "Nominal operations",
    caption:
      "VIPER 11, an F-16 out of Eielson, heads for the interior ranges. GPS III signals reach the jet and the fires battery. All indicators green.",
    shot: "region",
  },
  {
    id: "jam",
    start: 10,
    title: "Jamming onset",
    caption:
      "A satellite in the BeiDou constellation begins radiating interference across interior Alaska. VIPER 11 loses GPS lock; the ground battery loses precision guidance and time sync.",
    shot: "jam",
  },
  {
    id: "report",
    start: 22,
    title: "Pilot reports anomaly",
    caption:
      "VIPER 11 flags the PNT anomaly and sends an interference report to the Mission Data Processor (MDP).",
    shot: "region",
  },
  {
    id: "sbirs",
    start: 30,
    title: "SBIRS dome flags anomaly in orbit",
    caption:
      "Cued by the report, SBIRS HEO and GEO coverage over the Arctic highlights an anomalous emitter in medium Earth orbit.",
    shot: "space",
  },
  {
    id: "track",
    start: 42,
    title: "Track initiated",
    caption:
      "The MDP assigns a track UUID. A Kalman filter fuses detections into an orbital track; the MTT covariance ellipsoid shrinks as the solution converges.",
    shot: "jammer",
  },
  {
    id: "identify",
    start: 58,
    title: "Threat identified",
    caption:
      "Track correlates to BDS-3 M-X (notional). Threat level rises to CRITICAL and the satellite is marked hostile.",
    shot: "jammer",
  },
  {
    id: "flow",
    start: 68,
    title: "Sensors → MDP → commanders",
    caption:
      "Detections flow from SBIRS and VIPER 11 into the MDP, through the Validated Intel Hub, and on to commanders.",
    shot: "network",
  },
  {
    id: "push",
    start: 82,
    title: "Simultaneous push",
    caption:
      "The Intel Hub pushes the confirmed threat picture to all recipients at once: ALCOM, NORAD, INDOPACOM, VIPER 11 and the fires battery.",
    shot: "network",
  },
  {
    id: "mitigate",
    start: 92,
    title: "M-code and antenna nulling",
    caption:
      "User equipment switches to anti-jam M-code; CRPA antennas steer a null toward the jammer's bearing. GPS III signal margin recovers.",
    shot: "region",
  },
  {
    id: "restored",
    start: 106,
    title: "PNT restored",
    caption:
      "Navigation and timing restored. Threat picture updated across the force; mission advantage indicators return to green.",
    shot: "region",
  },
];

// Automatic camera cuts (story seconds). Opens wide so every satellite and orbit
// is in view, then moves in on the F-16, and pulls back whenever space matters.
export const CAMERA_CUES = [
  { t: 0, shot: "overview" },
  { t: 6, shot: "jet", duration: 4 },
  { t: 11, shot: "theater", duration: 3.5 },
  { t: 22, shot: "region" },
  { t: 30, shot: "space" },
  { t: 42, shot: "jammer" },
  { t: 68, shot: "network" },
  { t: 92, shot: "jet" },
  { t: 106, shot: "region" },
  { t: 113, shot: "overview", duration: 4 },
];

export function cueIndexAt(t) {
  let i = 0;
  for (let k = 0; k < CAMERA_CUES.length; k++) if (t >= CAMERA_CUES[k].t) i = k;
  return i;
}

export function phaseIndexAt(t) {
  let i = 0;
  for (let k = 0; k < PHASES.length; k++) if (t >= PHASES[k].start) i = k;
  return i;
}

// Timestamped event log entries (T+ seconds of story time).
export const EVENTS = [
  { t: 0, level: "ok", text: "VIPER 11 airborne, EGI GPS/INS blended" },
  { t: 12, level: "warn", text: "RF interference detected, L1/L2 bands" },
  { t: 14, level: "crit", text: "VIPER 11: PNT DEGRADED / NAVIGATION UNCERTAIN" },
  { t: 15, level: "crit", text: "FIRES BTY: PRECISION WEAPONS DEGRADED" },
  { t: 16, level: "crit", text: "FIRES BTY: TIME SYNC LOST" },
  { t: 23, level: "info", text: "VIPER 11 interference report sent to MDP" },
  { t: 32, level: "warn", text: "SBIRS: anomalous emitter in MEO" },
  { t: 43, level: "info", text: "MDP track initiated, UUID assigned" },
  { t: 52, level: "info", text: "Kalman solution converging, σ < 500 km" },
  { t: 59, level: "crit", text: "Track correlated: BDS-3 M-X (notional)" },
  { t: 60, level: "crit", text: "Threat level CRITICAL, object marked hostile" },
  { t: 70, level: "info", text: "Sensor data fused at MDP" },
  { t: 76, level: "info", text: "Intel validated at hub" },
  { t: 83, level: "info", text: "Threat picture pushed to all recipients" },
  { t: 94, level: "warn", text: "M-code enabled, CRPA null steered to jammer bearing" },
  { t: 107, level: "ok", text: "PNT RESTORED, time sync re-acquired" },
  { t: 110, level: "ok", text: "Mission advantage indicators green" },
];

export const TRACK_UUID = "7f3c9a2e-1b4d-4c8a-9e21-5d0b6a3f8c47";

const lerp = (a, b, x) => a + (b - a) * Math.min(1, Math.max(0, x));

// Covariance (1-sigma along-track, km) as the Kalman filter converges.
export function covarianceKm(t) {
  if (t < 42) return null;
  return 150 + 2400 * Math.exp(-(t - 42) / 5);
}

// Derived HUD state at story time t.
export function statusAt(t) {
  const jammed = t >= 14 && t < 106;
  const mitigating = t >= 94 && t < 106;
  const restored = t >= 106;

  // GPS carrier-to-noise density per tracked channel (dB-Hz)
  let cn0;
  if (t < 12) cn0 = 45;
  else if (t < 94) cn0 = lerp(45, 19, (t - 12) / 4);
  else cn0 = lerp(19, 41, (t - 94) / 10);

  // Estimated position uncertainty (NM)
  let epu;
  if (t < 14) epu = 0.02;
  else if (t < 94) epu = lerp(0.02, 2.8, (t - 14) / 30);
  else epu = lerp(2.8, 0.03, (t - 94) / 12);

  // Ground battery time error (ns)
  let timeErr;
  if (t < 16) timeErr = 12;
  else if (t < 96) timeErr = 12 + (t - 16) * 22;
  else timeErr = lerp(12 + 80 * 22, 15, (t - 96) / 10);

  let jet = { tone: "ok", headline: "PNT NOMINAL", sub: "EGI · GPS/INS BLEND" };
  if (jammed && !mitigating)
    jet = { tone: "crit", headline: "PNT DEGRADED", sub: "NAVIGATION UNCERTAIN · INS ONLY" };
  if (mitigating) jet = { tone: "warn", headline: "M-CODE ACQUIRING", sub: "CRPA NULL STEERED" };
  if (restored) jet = { tone: "ok", headline: "PNT RESTORED", sub: "EGI · M-CODE / GPS-INS BLEND" };

  const btyAlerts = [];
  if (t >= 15 && t < 106) btyAlerts.push("PRECISION WEAPONS DEGRADED");
  if (t >= 16 && t < 104) btyAlerts.push("TIME SYNC LOST");

  let threat = 0; // 0 low, 1 elevated, 2 high, 3 critical
  if (t >= 12) threat = 1;
  if (t >= 32) threat = 2;
  if (t >= 58) threat = 3;
  if (t >= 106) threat = 2; // jammer still radiating, but effects mitigated

  let trackState = null;
  if (t >= 42) trackState = t >= 58 ? "CONFIRMED HOSTILE" : "TENTATIVE";
  const cov = covarianceKm(t);
  const confidence = t < 42 ? 0 : Math.round(lerp(18, 97, (t - 42) / 22));

  const g = "ok", a = "warn", r = "crit";
  const pick = (...pairs) => {
    let v = pairs[0];
    for (let i = 1; i < pairs.length; i += 2) if (t >= pairs[i]) v = pairs[i + 1];
    return v;
  };
  const indicators = [
    { key: "PNT", label: "PNT Integrity", tone: pick(g, 14, r, 94, a, 106, g) },
    { key: "TIME", label: "Timing", tone: pick(g, 16, r, 96, a, 104, g) },
    { key: "FIRES", label: "Precision Fires", tone: pick(g, 15, r, 96, a, 106, g) },
    { key: "SDA", label: "Space Domain Awareness", tone: pick(g, 12, a, 58, g) },
    { key: "DEC", label: "Decision Advantage", tone: pick(g, 14, a, 83, g) },
  ];

  return {
    cn0, epu, timeErr, jet, btyAlerts, threat, trackState, cov, confidence, indicators,
    jammed, mitigating, restored,
  };
}
