# Edison · Alaska PNT Jammer Hunt

A CesiumJS + React prototype that plays a notional 2-minute scenario over Alaska:
a BeiDou-constellation satellite jams GNSS, an F-16 and a ground precision-fires battery
lose PNT, SBIRS and the MDP detect and track the emitter, intel is validated and pushed
to commanders, and M-code with CRPA antenna nulling restores PNT.

Notional, unclassified demo. Orbits, sites, timings and system behavior are illustrative.

## Run

Requires Node.js 18.18 or newer (20 LTS recommended).

```bash
npm install      # also copies Cesium assets into public/cesium
npm run dev      # opens http://localhost:5173
```

Production build: `npm run build`, then `npm run preview`.

Works offline out of the box (bundled Natural Earth II imagery, no Cesium ion account).
For sharper imagery, copy `.env.example` to `.env.local` and add a free Cesium ion token.

## Controls

- Play / Pause, Restart, 0.5× / 1× / 2× speed, and the scrubber (ticks mark each phase).
- Click any step in **Sequence of events** to jump to it.
- **Auto camera** cuts between shots at each phase. Turn it off to fly freely, or use the
  Alaska / Orbit / Jammer / Network buttons.

## Sequence (story seconds)

| T+   | Phase |
|------|-------|
| 0:00 | Nominal operations |
| 0:10 | Jamming onset: F-16 "PNT DEGRADED / NAVIGATION UNCERTAIN"; battery "PRECISION WEAPONS DEGRADED", "TIME SYNC LOST" |
| 0:22 | Pilot reports anomaly to MDP |
| 0:30 | SBIRS coverage dome flags anomaly in orbit |
| 0:42 | MDP assigns UUID; Kalman track and MTT covariance ellipsoid |
| 0:58 | Threat identified; satellite turns red and is highlighted |
| 1:08 | Data flows sensors → MDP → hub → commanders |
| 1:22 | Validated Intel Hub pushes to all recipients at once |
| 1:32 | M-code and CRPA antenna nulling |
| 1:46 | PNT restored; indicators green |

## Where things live

| File | What it does |
|------|--------------|
| `src/scenario/timeline.js` | Phases, captions, event log, and all HUD status as a function of time. Edit timings here. |
| `src/scenario/orbits.js` | Notional orbits (GPS III, BeiDou MEO, SBIRS GEO, SBIRS HEO/Molniya). |
| `src/scenario/buildScene.js` | Every Cesium entity: sites, F-16 route, beams, dome, track, covariance, data flows, camera shots. |
| `src/cesium/FlowLineMaterial.js` | Custom GLSL polyline material for animated signal pulses. |
| `src/components/Hud.jsx` | Panels: sequence, event log, F-16, fires battery, threat picture, indicators, transport. |

Everything on screen is computed from story time `t`, so scrubbing and replay always stay consistent.

## Narration

Press **Start briefing** to begin. Each caption is read aloud as its phase starts, using the
browser's built-in text-to-speech. Edge on Windows has the most natural voices ("Microsoft …
Online (Natural)"); Chrome works too. Toggle it with **Narration** in the control bar.
Pronunciations for acronyms (SBIRS → "Sibbers", VIPER 11 → "Viper one-one", …) are in
`src/audio/narrator.js`.

To use a recorded voice-over instead, drop MP3s named after each phase id into `public/audio/`:
`nominal.mp3, jam.mp3, report.mp3, sbirs.mp3, track.mp3, identify.mp3, flow.mp3, push.mp3,
mitigate.mp3, restored.mp3`. Any clip present replaces the synthetic voice for that phase and
follows pause, scrubbing and playback speed. Keep each clip shorter than its phase (see the
sequence table above).

## Deploy to UDS

Requires Docker and the `uds` CLI on a machine running UDS Core (e.g. the k3d demo).

```bash
docker build -t edison:0.1.0 .
uds zarf package create . --confirm
uds zarf package deploy zarf-package-edison-*-0.1.0.tar.zst --confirm
uds zarf tools kubectl get pods,package -n edison
```

Then open https://edison.uds.dev. To release a change, bump `0.1.0` in the `docker build` tag,
`uds/manifests.yaml` and `zarf.yaml`, then rebuild and redeploy.
Remove with `uds zarf package remove edison --confirm`.
