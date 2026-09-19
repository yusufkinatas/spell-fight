// All audio: synthesized effects and settings. It plays what it is told to; it decides nothing.
// Effects are WebAudio oscillators, noise and envelopes: no audio files.

import type { Cue } from "./game.ts";

// Settings persist in localStorage, wrapped so a blocked storage never breaks the game.
const STORAGE_KEY = "spellcrafting-duel.audio";
export const settings = { effects: true, music: true };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
} catch {}

let ctx: AudioContext | undefined;
let effectsOut: GainNode;

// Call from a user gesture (the Begin press): browsers, phones above all, only start audio from one.
export function unlockAudio() {
  ctx ??= new AudioContext();
  void ctx.resume();
  if (!effectsOut) {
    effectsOut = ctx.createGain();
    effectsOut.connect(ctx.destination);
  }
  apply();
}

function apply() {
  if (ctx) effectsOut.gain.value = settings.effects ? 0.5 : 0;
}

export function setSetting(key: keyof typeof settings, on: boolean) {
  settings[key] = on;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
  apply();
}

// --- synthesis primitives -------------------------------------------------------------------------------------------

type Shape = { at?: number; gain?: number; to?: number; type?: OscillatorType; filter?: BiquadFilterType };

// An enveloped node: fast attack, exponential decay over `dur` seconds, starting `at` seconds from now.
function envelope(source: AudioScheduledSourceNode, tail: AudioNode, dur: number, gain: number, at: number) {
  const amp = ctx!.createGain();
  const t = ctx!.currentTime + at;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  tail.connect(amp).connect(effectsOut);
  source.start(t);
  source.stop(t + dur + 0.05);
}

// A pitched voice, optionally gliding from `freq` to `to`.
function tone(freq: number, dur: number, { at = 0, gain = 0.3, to, type = "sine" }: Shape = {}) {
  const osc = ctx!.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx!.currentTime + at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, ctx!.currentTime + at + dur);
  envelope(osc, osc, dur, gain, at);
}

let noiseBuffer: AudioBuffer | undefined;
// Filtered white noise; the filter frequency can sweep from `freq` to `to`.
function noise(freq: number, dur: number, { at = 0, gain = 0.3, to, filter = "bandpass" }: Shape = {}) {
  if (!noiseBuffer) {
    noiseBuffer = ctx!.createBuffer(1, ctx!.sampleRate, ctx!.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = ctx!.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  const band = ctx!.createBiquadFilter();
  band.type = filter;
  band.frequency.setValueAtTime(freq, ctx!.currentTime + at);
  if (to) band.frequency.exponentialRampToValueAtTime(to, ctx!.currentTime + at + dur);
  envelope(source, source.connect(band), dur, gain, at);
}

// --- one small function per event; `i` is an intensity 0..1 -----------------------------------------------------------

const EFFECTS = {
  chime: () => (tone(1320, 0.25, { gain: 0.12 }), tone(1980, 0.18, { gain: 0.05 })),
  click: () => tone(520, 0.05, { gain: 0.1, type: "triangle" }),
  cast: () => noise(300, 0.4, { to: 3000, gain: 0.35 }),
  // Pitch and gain rise with Offence; a 0 is a dull tap.
  hit: (i: number) => (tone(90 + i * 130, 0.3, { to: 45, gain: 0.15 + i * 0.75, type: "triangle" }), noise(500 + i * 2500, 0.18, { gain: 0.08 + i * 0.5, filter: "lowpass" })),
  immune: () => [523, 784 * 1.07, 1245].forEach((f) => tone(f, 0.5, { gain: 0.12, type: "square" })),
  fizzle: () => (noise(4000, 0.5, { to: 300, gain: 0.25, filter: "highpass" }), tone(420, 0.45, { to: 90, gain: 0.12, type: "sawtooth" })),
  instantKill: () => (tone(110, 0.9, { to: 28, gain: 0.9 }), noise(6000, 0.7, { to: 200, gain: 0.5, filter: "lowpass" }), [523, 659, 784, 1047].forEach((f, n) => tone(f, 0.5, { at: 0.08 * n, gain: 0.15, type: "triangle" }))),
  attackLands: () => tone(70, 0.2, { to: 40, gain: 0.35 }),
  // Lower and louder the more damage gets through.
  hurt: (i: number) => (tone(260 - i * 120, 0.4, { to: 60, gain: 0.12 + i * 0.5, type: "sawtooth" }), noise(900, 0.25, { gain: 0.05 + i * 0.35, filter: "lowpass" })),
  shield: () => (tone(1175, 0.35, { gain: 0.18 }), tone(1760, 0.3, { at: 0.04, gain: 0.1 })),
  enemyDeath: () => (tone(300, 0.75, { to: 35, gain: 0.35, type: "sawtooth" }), noise(1200, 0.7, { to: 100, gain: 0.25, filter: "lowpass" })),
  barrierShatter: () => (noise(7000, 0.6, { gain: 0.45, filter: "highpass" }), [2093, 2637, 3136, 3951, 2349].forEach((f, n) => tone(f, 0.3, { at: 0.05 * n, gain: 0.1 }))),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, n) => tone(f, n === 4 ? 1.2 : 0.35, { at: 0.16 * n, gain: 0.25, type: "triangle" })),
  lose: () => [440, 349, 294, 220].forEach((f, n) => tone(f, n === 3 ? 1.4 : 0.5, { at: 0.3 * n, gain: 0.25, type: "triangle" })),
};

export function effect(name: keyof typeof EFFECTS, intensity = 1) {
  if (ctx && settings.effects) EFFECTS[name](Math.min(1, intensity));
}

// Same scaling as the visuals: Offence out of 5, damage out of the hardest hit in the game.
export function playCue(cue: Cue) {
  if (cue.kind === "hit") effect("hit", cue.intensity / 5);
  else if (cue.kind === "hurt") effect("hurt", cue.intensity / 6);
  else if (cue.kind === "instant-kill") effect("instantKill");
  else if (cue.kind === "attack-lands") effect("attackLands");
  else if (cue.kind === "enemy-death") effect("enemyDeath");
  else if (cue.kind === "barrier-shatter") effect("barrierShatter");
  else if (cue.kind !== "player-death") effect(cue.kind); // the lose jingle marks the player's death
}

// Looping shimmer while the Judge deliberates. Returns the function that stops it.
export function shimmer(): () => void {
  if (!ctx || !settings.effects) return () => {};
  const amp = ctx.createGain();
  amp.gain.value = 0;
  amp.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.3);
  amp.connect(effectsOut);
  const wobble = ctx.createOscillator(); // tremolo
  wobble.frequency.value = 5;
  const depth = ctx.createGain();
  depth.gain.value = 0.04;
  wobble.connect(depth).connect(amp.gain);
  const voices = [660, 990, 1485].map((f) => {
    const osc = ctx!.createOscillator();
    osc.frequency.value = f;
    osc.connect(amp);
    return osc;
  });
  [wobble, ...voices].forEach((o) => o.start());
  return () => {
    depth.disconnect();
    amp.gain.cancelScheduledValues(ctx!.currentTime);
    amp.gain.setTargetAtTime(0, ctx!.currentTime, 0.05);
    [wobble, ...voices].forEach((o) => o.stop(ctx!.currentTime + 0.4));
  };
}
