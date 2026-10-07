import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CesiumStage from "./components/CesiumStage";
import { SequencePanel, EventLog, JetPanel, BatteryPanel, ThreatPanel, Indicators, Caption, Transport } from "./components/Hud";
import { DURATION, PHASES, phaseIndexAt, statusAt } from "./scenario/timeline";
import { Narrator } from "./audio/narrator";

export default function App() {
  const ctl = useRef(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [autoCam, setAutoCam] = useState(true);
  const [panelsOpen, setPanelsOpen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [started, setStarted] = useState(false);
  const narrator = useMemo(() => new Narrator(), []);
  const last = useRef({ at: 0, playing: false });

  // Cesium ticks every frame; push to React ~15×/s.
  const onTick = useCallback((time, isPlaying) => {
    const now = performance.now();
    if (now - last.current.at > 66 || isPlaying !== last.current.playing) {
      last.current = { at: now, playing: isPlaying };
      setT(time);
      setPlaying(isPlaying);
    }
  }, []);

  const status = useMemo(() => statusAt(t), [t]);
  const phaseIdx = phaseIndexAt(t);
  const offsetIn = (x) => x - PHASES[phaseIndexAt(x)].start;

  // Narration follows the phase and play state.
  const tRef = useRef(0);
  tRef.current = t;
  useEffect(() => {
    if (playing && narrator.active?.idx !== phaseIdx) narrator.start(phaseIdx, offsetIn(tRef.current));
    if (!playing && narrator.active && narrator.active.idx !== phaseIdx) narrator.stop();
  }, [phaseIdx]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (playing) narrator.resume(phaseIdx, offsetIn(tRef.current));
    else narrator.pause();
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => narrator.stop(), [narrator]);

  const api = {
    toggle: () => (playing ? ctl.current?.pause() : ctl.current?.play()),
    restart: () => {
      ctl.current?.seek(0);
      ctl.current?.play();
      narrator.start(0, 0);
    },
    seek: (x) => {
      ctl.current?.seek(x);
      if (playing) narrator.start(phaseIndexAt(x), offsetIn(x));
      else narrator.stop();
    },
    speed: (x) => {
      setSpeed(x);
      ctl.current?.setSpeed(x);
      narrator.setSpeed(x);
    },
    voice: (on) => {
      setVoiceOn(on);
      narrator.setEnabled(on);
      if (on && playing) narrator.start(phaseIdx, offsetIn(t));
    },
    begin: () => {
      setStarted(true);
      narrator.setEnabled(voiceOn);
      ctl.current?.seek(0);
      ctl.current?.play();
    },
    autoCam: (v) => {
      setAutoCam(v);
      ctl.current?.setAutoCamera(v);
    },
    shot: (name) => {
      setAutoCam(false);
      ctl.current?.setAutoCamera(false);
      ctl.current?.shot(name, 2);
    },
  };

  return (
    <div className="app">
      <CesiumStage onReady={(c) => { ctl.current = c; window.__edison = c; /* handy for console debugging */ }} onTick={onTick} />

      {!started && (
        <div className="start-overlay">
          <div className="start-card panel">
            <span className="eyebrow">Notional scenario · 2 min</span>
            <h1>Alaska PNT Jammer Hunt</h1>
            <p>A BeiDou-constellation satellite jams GNSS over interior Alaska. Follow detection, tracking, dissemination and recovery.</p>
            <label className="check">
              <input id="voice-start" type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} />
              Play narration
            </label>
            <button className="btn primary big" onClick={api.begin} autoFocus>
              ▶ Start briefing
            </button>
          </div>
        </div>
      )}

      <div className="hud">
        <header className="topbar panel">
          <div className="brand">
            <span className="brand-mark">EDISON</span>
            <span className="brand-sub">Alaska PNT Jammer Hunt</span>
          </div>
          <div className="phase-now">
            <span className="eyebrow">Phase {phaseIdx + 1} / {PHASES.length}</span>
            <span className="phase-title">{PHASES[phaseIdx].title}</span>
          </div>
          <div className="topbar-right">
            <span className="notional">Notional scenario · unclassified demo</span>
            <button className="btn ghost panels-toggle" onClick={() => setPanelsOpen((v) => !v)}>
              {panelsOpen ? "Hide panels" : "Panels"}
            </button>
          </div>
        </header>

        <aside className={`col left ${panelsOpen ? "open" : ""}`}>
          <SequencePanel t={t} phaseIdx={phaseIdx} onSeek={api.seek} />
          <Indicators s={status} />
          <EventLog t={t} />
        </aside>

        <aside className={`col right ${panelsOpen ? "open" : ""}`}>
          <JetPanel s={status} t={t} />
          <BatteryPanel s={status} />
          <ThreatPanel s={status} />
        </aside>

        <Caption phase={PHASES[phaseIdx]} />

        <div className="bottom">
          <Transport
            t={t}
            duration={DURATION}
            playing={playing}
            speed={speed}
            autoCam={autoCam}
            voiceOn={voiceOn}
            api={api}
          />
        </div>
      </div>
    </div>
  );
}
