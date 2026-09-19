// All audio: synthesized effects, music and settings. It plays what it is told to; it decides nothing.
// Effects are WebAudio oscillators, noise and envelopes: no audio files. Music is one OGG file per slot in public/music.

import type { Cue } from "./game.ts";

// Settings persist in localStorage, wrapped so a blocked storage never breaks the game.
const STORAGE_KEY = "spell-fight.audio";
export const settings = { effects: true, music: true };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
} catch {}

let ctx: AudioContext | undefined;
let effectsOut: GainNode;
let musicOut: GainNode; // the music toggle
let duckOut: GainNode; // dips under the jingles

// Call from a user gesture (the Begin press): browsers, phones above all, only start audio from one.
export function unlockAudio() {
  ctx ??= new AudioContext();
  void ctx.resume();
  if (!effectsOut) {
    effectsOut = ctx.createGain();
    effectsOut.connect(ctx.destination);
    musicOut = ctx.createGain();
    duckOut = ctx.createGain();
    musicOut.connect(duckOut).connect(ctx.destination);
  }
  apply();
}

function apply() {
  if (!ctx) return;
  effectsOut.gain.value = settings.effects ? 0.5 : 0;
  musicOut.gain.value = settings.music ? 0.4 : 0;
  syncMusic();
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
  if (!ctx || !settings.effects) return;
  EFFECTS[name](Math.min(1, intensity));
  if (name === "win" || name === "lose") duck(2.5);
}

// Same scaling as the visuals: Offence out of 5, damage out of the hardest hit in the game.
export function playCue(cue: Cue) {
  if (cue.kind === "hit") effect("hit", cue.intensity / 5);
  else if (cue.kind === "hurt") effect("hurt", cue.intensity / 6);
  else if (cue.kind === "hollow") effect("fizzle"); // the spell comes apart, like a Fizzle
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

// --- music ----------------------------------------------------------------------------------------------------------

// To swap a track, replace its file in public/music. `crossfade` is the seconds of overlap when the track loops into
// itself (for tracks with an ending); 0 means the file is a seamless loop and plays gapless.
const TRACKS = {
  title: { url: "/music/title.ogg", crossfade: 5 }, // "Ossuary 1 - A Beginning", Kevin MacLeod
  golem: { url: "/music/golem.ogg", crossfade: 4 }, // "Clash Defiant", Kevin MacLeod
  knight: { url: "/music/knight.ogg", crossfade: 4 }, // "Unholy Knight", Kevin MacLeod
  witch: { url: "/music/witch.ogg", crossfade: 4 }, // "Moorland", Kevin MacLeod
  wraith: { url: "/music/wraith.ogg", crossfade: 4 }, // "Volatile Reaction", Kevin MacLeod
  boss: { url: "/music/boss.ogg", crossfade: 0 }, // "Epic Boss Battle", Juhani Junkala
};
export type Slot = keyof typeof TRACKS;
const SLOT_FADE = 1.5; // seconds to crossfade between slots

const buffers: Partial<Record<Slot, Promise<AudioBuffer>>> = {};
let wanted: Slot | undefined; // what the game asked for
let playing: Slot | undefined; // what is sounding (or loading)
let stopVoice = () => {};
let request = 0; // only the latest request may start a voice

// Ask for a slot. Asking for the one already playing changes nothing, so the boss track runs on through the Phase change.
export function music(slot: Slot) {
  wanted = slot;
  syncMusic();
}

function syncMusic() {
  const slot = settings.music ? wanted : undefined;
  if (!ctx || slot === playing) return;
  stopVoice();
  stopVoice = () => {};
  playing = slot;
  const mine = ++request;
  if (!slot) return;
  // Fetched lazily, only once audio is unlocked and music is on: never before the first interaction.
  buffers[slot] ??= fetch(TRACKS[slot].url)
    .then((res) => res.arrayBuffer())
    .then((data) => ctx!.decodeAudioData(data));
  buffers[slot].then(
    (buffer) => {
      if (mine === request) stopVoice = startVoice(buffer, TRACKS[slot].crossfade);
    },
    (e) => {
      console.error(e); // no music is not worth breaking the game over
      delete buffers[slot];
    },
  );
}

// Loops `buffer` until the returned function fades it out.
function startVoice(buffer: AudioBuffer, crossfade: number): () => void {
  const out = ctx!.createGain();
  out.gain.setValueAtTime(0, ctx!.currentTime);
  out.gain.linearRampToValueAtTime(1, ctx!.currentTime + SLOT_FADE);
  out.connect(musicOut);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sources: AudioBufferSourceNode[] = [];
  // One pass of the track starting at audio time `t`; with a crossfade it fades in and out and books the next pass.
  const pass = (t: number, first: boolean) => {
    const source = ctx!.createBufferSource();
    source.buffer = buffer;
    source.loop = crossfade === 0;
    const amp = ctx!.createGain();
    source.connect(amp).connect(out);
    source.start(t);
    sources = [...sources.slice(-1), source];
    if (crossfade === 0) return;
    const next = t + buffer.duration - crossfade;
    if (!first) {
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(1, t + crossfade);
    }
    amp.gain.setValueAtTime(1, next);
    amp.gain.linearRampToValueAtTime(0, next + crossfade);
    // Book the next pass on the audio clock a few seconds early, so a throttled timer cannot open a gap.
    timer = setTimeout(() => pass(next, false), (next - ctx!.currentTime - 5) * 1000);
  };
  pass(ctx!.currentTime, true);
  return () => {
    clearTimeout(timer);
    out.gain.cancelScheduledValues(ctx!.currentTime);
    out.gain.setValueAtTime(out.gain.value, ctx!.currentTime);
    out.gain.linearRampToValueAtTime(0, ctx!.currentTime + SLOT_FADE);
    sources.forEach((source) => source.stop(ctx!.currentTime + SLOT_FADE));
  };
}

function duck(seconds: number) {
  const t = ctx!.currentTime;
  duckOut.gain.cancelScheduledValues(t);
  duckOut.gain.setTargetAtTime(0.15, t, 0.05);
  duckOut.gain.setTargetAtTime(1, t + seconds, 0.4);
}
