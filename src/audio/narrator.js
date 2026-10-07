// Voice-over for each phase caption.
//
// Default: the browser's built-in text-to-speech (Web Speech API), speaking the
// same text shown in the caption. On Windows, Edge and Chrome offer natural
// "Microsoft ... Online (Natural)" voices; the best available English voice is picked.
//
// Optional: drop recorded clips into public/audio/<phase id>.mp3 (for example
// public/audio/jam.mp3). Any clip found there plays instead of the synthetic
// voice for that phase and stays in sync with pause, scrub and speed.

import { PHASES, DURATION } from "../scenario/timeline";

// How acronyms and call signs should be spoken (captions stay as written).
const SAY = [
  [/\bVIPER 11\b/g, "Viper one-one"],
  [/\bF-16C?\b/g, "F sixteen"],
  [/\bGPS III\b/g, "GPS three"],
  [/\bBDS-3 M-X\b/g, "B D S three, M X"],
  [/\bSBIRS\b/g, "Sibbers"],
  [/\bHEO\b/g, "H E O"],
  [/\bGEO\b/g, "geo"],
  [/\bMDP\b/g, "M D P"],
  [/\bUUID\b/g, "U U I D"],
  [/\bMTT\b/g, "M T T"],
  [/\bPNT\b/g, "P N T"],
  [/\bCRPA\b/g, "C R P A"],
  [/\bM-code\b/g, "M code"],
  [/\bALCOM\b/g, "Al-com"],
  [/\bNORAD\b/g, "Nor-ad"],
  [/\bINDOPACOM\b/g, "Indo-Pay-Com"],
  [/\bEielson\b/g, "Eyelson"],
  [/\s*→\s*/g, " to "],
];
const spoken = (text) => SAY.reduce((s, [re, rep]) => s.replace(re, rep), text);

const phaseEnd = (i) => (PHASES[i + 1]?.start ?? DURATION);

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const en = voices.filter((v) => /^en[-_]/i.test(v.lang));
  const prefs = [/Natural/i, /Aria|Jenny|Guy|Davis/i, /Google US English/i, /Samantha|Alex/i, /en-US/i];
  for (const re of prefs) {
    const v = en.find((x) => re.test(x.name) || re.test(x.lang));
    if (v) return v;
  }
  return en[0] ?? voices[0] ?? null;
}

export class Narrator {
  constructor() {
    this.enabled = true;
    this.speed = 1;
    this.clips = {}; // phase id -> HTMLAudioElement (recorded voice-over)
    this.active = null; // { idx, kind: "clip" | "tts" }
    this.voice = null;
    const synth = window.speechSynthesis;
    if (synth) {
      this.voice = pickVoice();
      synth.addEventListener?.("voiceschanged", () => (this.voice = pickVoice()));
    }
    this._probeClips();
  }

  // Look for optional recorded clips in public/audio.
  async _probeClips() {
    await Promise.all(
      PHASES.map(async (p) => {
        const url = `/audio/${p.id}.mp3`;
        try {
          const r = await fetch(url, { method: "HEAD" });
          const type = r.headers.get("content-type") || "";
          if (r.ok && type.startsWith("audio")) {
            const a = new Audio(url);
            a.preload = "auto";
            this.clips[p.id] = a;
          }
        } catch {
          /* no clip: synthetic voice is used */
        }
      })
    );
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.stop();
  }

  setSpeed(x) {
    this.speed = x;
    for (const a of Object.values(this.clips)) a.playbackRate = x;
  }

  // Start narration for phase idx, `offset` seconds into the phase.
  start(idx, offset = 0) {
    this.stop();
    if (!this.enabled) return;
    const p = PHASES[idx];
    const clip = this.clips[p.id];
    if (clip) {
      if (offset >= (clip.duration || Infinity)) return;
      clip.currentTime = Math.max(0, offset);
      clip.playbackRate = this.speed;
      clip.play().catch(() => {});
      this.active = { idx, kind: "clip", clip };
      return;
    }
    // Synthetic speech can't start mid-sentence; skip if we're well into the phase.
    const len = phaseEnd(idx) - p.start;
    if (offset > len * 0.35 || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(spoken(p.caption));
    if (this.voice) u.voice = this.voice;
    u.lang = this.voice?.lang ?? "en-US";
    u.rate = Math.min(2, 1.05 * Math.max(0.8, this.speed));
    u.pitch = 1;
    window.speechSynthesis.speak(u);
    this.active = { idx, kind: "tts" };
  }

  pause() {
    if (!this.active) return;
    if (this.active.kind === "clip") this.active.clip.pause();
    else window.speechSynthesis?.pause();
  }

  resume(idx, offset) {
    if (!this.enabled) return;
    if (!this.active || this.active.idx !== idx) return this.start(idx, offset);
    if (this.active.kind === "clip") this.active.clip.play().catch(() => {});
    else window.speechSynthesis?.resume();
  }

  stop() {
    if (this.active?.kind === "clip") this.active.clip.pause();
    window.speechSynthesis?.cancel();
    this.active = null;
  }
}
