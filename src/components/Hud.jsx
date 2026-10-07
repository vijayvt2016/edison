import { PHASES, EVENTS, TRACK_UUID } from "../scenario/timeline";

const fmt = (t) => {
  const s = Math.max(0, Math.floor(t));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const TONE_WORD = { ok: "GREEN", warn: "AMBER", crit: "RED" };

export function SequencePanel({ t, phaseIdx, onSeek }) {
  return (
    <section className="panel">
      <h2 className="eyebrow">Sequence of events</h2>
      <ol className="seq">
        {PHASES.map((p, i) => {
          const state = i < phaseIdx ? "done" : i === phaseIdx ? "active" : "todo";
          return (
            <li key={p.id} className={`seq-item ${state}`}>
              <button onClick={() => onSeek(p.start + 0.01)} title={`Jump to ${p.title}`}>
                <span className="seq-time mono">T+{fmt(p.start)}</span>
                <span className="seq-title">{p.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function EventLog({ t }) {
  const shown = EVENTS.filter((e) => e.t <= t).slice(-5).reverse();
  return (
    <section className="panel log">
      <h2 className="eyebrow">Event log</h2>
      <ul>
        {shown.map((e) => (
          <li key={e.t + e.text} className={`log-${e.level}`}>
            <span className="mono log-t">T+{fmt(e.t)}</span>
            <span>{e.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Pill({ tone, children }) {
  return <span className={`pill tone-${tone}`}>{children}</span>;
}

// Deterministic per-channel variation so bars look like real receiver channels.
const PRNS = [5, 12, 15, 18, 24, 29];
const OFFS = [1.5, -2, 0.5, -1, 2.5, -0.5];

export function JetPanel({ s, t }) {
  const nav = s.restored ? "M-CODE" : s.mitigating ? "M-CODE ACQ" : s.jammed ? "INS ONLY" : "GPS/INS";
  return (
    <section className={`panel asset tone-border-${s.jet.tone}`}>
      <div className="asset-head">
        <h2 className="eyebrow">VIPER 11 · F-16C</h2>
        <Pill tone={s.jet.tone}>{TONE_WORD[s.jet.tone]}</Pill>
      </div>
      <div className={`alert tone-${s.jet.tone} ${s.jet.tone === "crit" ? "blink" : ""}`}>
        <strong>{s.jet.headline}</strong>
        <span>{s.jet.sub}</span>
      </div>
      <div className="cn0">
        <span className="metric-label">GPS C/N₀ (dB-Hz)</span>
        <div className="bars">
          {PRNS.map((prn, i) => {
            const v = Math.max(0, s.cn0 + OFFS[i] + Math.sin(t * 3 + i) * (s.jammed && !s.mitigating ? 2.5 : 0.4));
            const tone = v >= 35 ? "ok" : v >= 28 ? "warn" : "crit";
            return (
              <div className="bar" key={prn}>
                <div className="bar-track">
                  <div className={`bar-fill tone-bg-${tone}`} style={{ height: `${(v / 50) * 100}%` }} />
                </div>
                <span className="mono">{prn}</span>
              </div>
            );
          })}
        </div>
      </div>
      <dl className="metrics">
        <div><dt>EPU</dt><dd className="mono">{s.epu.toFixed(2)} NM</dd></div>
        <div><dt>Nav source</dt><dd className="mono">{nav}</dd></div>
      </dl>
    </section>
  );
}

export function BatteryPanel({ s }) {
  const tone = s.btyAlerts.length ? (s.mitigating ? "warn" : "crit") : "ok";
  const te = s.timeErr >= 1000 ? `${(s.timeErr / 1000).toFixed(2)} µs` : `${Math.round(s.timeErr)} ns`;
  return (
    <section className={`panel asset tone-border-${tone}`}>
      <div className="asset-head">
        <h2 className="eyebrow">FIRES BTY A · Precision fires</h2>
        <Pill tone={tone}>{TONE_WORD[tone]}</Pill>
      </div>
      {s.btyAlerts.length ? (
        s.btyAlerts.map((a) => (
          <div key={a} className={`alert tone-${tone} ${tone === "crit" ? "blink" : ""}`}>
            <strong>{a}</strong>
          </div>
        ))
      ) : (
        <div className="alert tone-ok">
          <strong>{s.restored ? "PRECISION FIRES RESTORED" : "PRECISION FIRES READY"}</strong>
          <span>{s.restored ? "Time sync re-acquired · M-code" : "GPS time locked"}</span>
        </div>
      )}
      <dl className="metrics">
        <div><dt>Time error</dt><dd className="mono">{te}</dd></div>
        <div><dt>GPS-aided munitions</dt><dd className="mono">{tone === "ok" ? "READY" : tone === "warn" ? "RECOVERING" : "DEGRADED"}</dd></div>
      </dl>
    </section>
  );
}

const THREAT = ["LOW", "ELEVATED", "HIGH", "CRITICAL"];

export function ThreatPanel({ s }) {
  const tone = s.threat >= 3 ? "crit" : s.threat >= 1 ? "warn" : "ok";
  return (
    <section className="panel">
      <div className="asset-head">
        <h2 className="eyebrow">Threat picture</h2>
        <Pill tone={tone}>{THREAT[s.threat]}</Pill>
      </div>
      <div className="threat-meter" aria-label={`Threat level ${THREAT[s.threat]}`}>
        {THREAT.map((l, i) => (
          <div key={l} className={`seg ${i <= s.threat ? `on-${i}` : ""}`}>
            <span>{l}</span>
          </div>
        ))}
      </div>
      {s.trackState ? (
        <dl className="track mono">
          <div><dt>Track UUID</dt><dd className="uuid">{TRACK_UUID}</dd></div>
          <div><dt>Object</dt><dd>{s.trackState === "CONFIRMED HOSTILE" ? "BDS-3 M-X (notional)" : "UNCORRELATED · MEO"}</dd></div>
          <div><dt>Orbit</dt><dd>MEO · 21,528 km · i 55°</dd></div>
          <div><dt>Filter</dt><dd>EKF · MTT</dd></div>
          <div><dt>1σ along-track</dt><dd>{Math.round(s.cov)} km</dd></div>
          <div><dt>Confidence</dt><dd>{s.confidence}%</dd></div>
          <div><dt>State</dt><dd className={s.trackState === "CONFIRMED HOSTILE" ? "tone-text-crit" : "tone-text-warn"}>{s.restored ? "HOSTILE · MITIGATED" : s.trackState}</dd></div>
        </dl>
      ) : (
        <p className="muted small">{s.threat ? "RF anomaly reported · awaiting sensor cue" : "No tracks of interest"}</p>
      )}
    </section>
  );
}

export function Indicators({ s }) {
  return (
    <section className="panel">
      <h2 className="eyebrow">Mission advantage</h2>
      <ul className="indicators">
        {s.indicators.map((i) => (
          <li key={i.key}>
            <span className={`dot tone-bg-${i.tone}`} />
            <span className="ind-label">{i.label}</span>
            <span className={`mono tone-text-${i.tone}`}>{TONE_WORD[i.tone]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Caption({ phase }) {
  return (
    <div className="caption panel" key={phase.id}>
      <span className="eyebrow">{phase.title}</span>
      <p>{phase.caption}</p>
    </div>
  );
}

export function Transport({ t, duration, playing, speed, autoCam, voiceOn, api }) {
  return (
    <div className="transport panel">
      <div className="transport-row">
        <button className="btn primary" onClick={api.toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button className="btn" onClick={api.restart}>Restart</button>
        <div className="seg-ctl" role="group" aria-label="Playback speed">
          {[0.5, 1, 2].map((x) => (
            <button key={x} className={`btn ${speed === x ? "on" : ""}`} onClick={() => api.speed(x)}>
              {x}×
            </button>
          ))}
        </div>
        <button
          className={`btn ${voiceOn ? "on" : ""}`}
          onClick={() => api.voice(!voiceOn)}
          aria-pressed={voiceOn}
          title="Spoken narration of the captions"
        >
          {voiceOn ? "🔊 Narration" : "🔇 Narration"}
        </button>
        <span className="clock mono">T+{fmt(t)} / {fmt(duration)}</span>
        <div className="spacer" />
        <label className="check">
          <input id="autocam" type="checkbox" checked={autoCam} onChange={(e) => api.autoCam(e.target.checked)} />
          Auto camera
        </label>
        <div className="seg-ctl" role="group" aria-label="Camera views">
          <button className="btn" onClick={() => api.shot("overview")}>Overview</button>
          <button className="btn" onClick={() => api.shot("jet")}>F-16</button>
          <button className="btn" onClick={() => api.shot("region")}>Alaska</button>
          <button className="btn" onClick={() => api.shot("jammer")}>Jammer</button>
          <button className="btn" onClick={() => api.shot("network")}>Network</button>
        </div>
      </div>
      <div className="scrub">
        <input
          id="scrubber"
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={t}
          onChange={(e) => api.seek(Number(e.target.value))}
          aria-label="Scenario time"
        />
        <div className="ticks">
          {PHASES.map((p) => (
            <span key={p.id} style={{ left: `${(p.start / duration) * 100}%` }} title={p.title} />
          ))}
        </div>
      </div>
    </div>
  );
}
