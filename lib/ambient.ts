// Música ambiente 100% digital — gerada em tempo real via Web Audio API,
// sem nenhum arquivo de áudio. Estilo: lo-fi "baile bossa" instrumental,
// ~96 BPM, loop de 4 compassos em Lá menor (Am7 → Fmaj7 → Cmaj7 → G7),
// com groove inspirado no tamborzão, baixo quente, pad suave e plucks
// pentatônicos esparsos com eco. Volume baixo por design (camada de fundo).

import { getAudioContext } from "@/lib/sound";

const BPM = 96;
const STEP_DUR = 60 / BPM / 4; // semicolcheia
const STEPS_PER_BAR = 16;
const BARS = 4;
const TOTAL_STEPS = BARS * STEPS_PER_BAR;
const LOOKAHEAD_MS = 100;
const SCHEDULE_AHEAD = 0.25; // segundos
const MASTER_LEVEL = 0.6;
const FADE_S = 2.5;

// Progressão: baixo (root) + pad (4 notas por acorde)
const PROGRESSION = [
  { bass: 110.0,  pad: [220.0, 261.63, 329.63, 392.0] },   // Am7
  { bass: 87.31,  pad: [174.61, 220.0, 261.63, 329.63] },  // Fmaj7
  { bass: 130.81, pad: [196.0, 261.63, 329.63, 493.88] },  // Cmaj7
  { bass: 98.0,   pad: [196.0, 246.94, 293.66, 349.23] },  // G7
];

// Pentatônica de Lá menor para os plucks
const PENTA = [440.0, 523.25, 587.33, 659.25, 783.99];

// Groove tamborzão simplificado (posições da semicolcheia no compasso)
const KICK_STEPS = [0, 3, 6, 10];
const HAT_STEPS = [2, 6, 10, 14];

let playing = false;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextTime = 0;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function buildMaster(ctx: AudioContext): GainNode {
  const gain = ctx.createGain();
  // Filtro lowpass dá o calor "lo-fi" (corta o brilho digital)
  const warmth = ctx.createBiquadFilter();
  warmth.type = "lowpass";
  warmth.frequency.value = 2800;
  warmth.Q.value = 0.4;
  gain.connect(warmth).connect(ctx.destination);
  return gain;
}

function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(ctx.sampleRate * 0.1);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function kick(ctx: AudioContext, out: GainNode, t: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(0.14, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.25);
}

function hat(ctx: AudioContext, out: GainNode, t: number, accent: boolean) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(accent ? 0.03 : 0.018, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(hp).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.06);
}

function bass(ctx: AudioContext, out: GainNode, t: number, freq: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.07, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + STEP_DUR * 3);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + STEP_DUR * 3.2);
}

function pad(ctx: AudioContext, out: GainNode, t: number, freqs: number[]) {
  const barDur = STEP_DUR * STEPS_PER_BAR;
  for (const f of freqs) {
    // Duas vozes levemente desafinadas por nota = textura análoga/quente
    for (const detune of [-4, 4]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t);
      osc.detune.setValueAtTime(detune, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.011, t + barDur * 0.3);
      g.gain.linearRampToValueAtTime(0.008, t + barDur * 0.8);
      g.gain.linearRampToValueAtTime(0, t + barDur);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + barDur + 0.05);
    }
  }
}

function pluck(ctx: AudioContext, out: GainNode, t: number) {
  const freq = PENTA[Math.floor(Math.random() * PENTA.length)];
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.045, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);

  // Eco simples (delay pontuado com feedback) — assinatura do lo-fi
  const delay = ctx.createDelay(1);
  delay.delayTime.value = STEP_DUR * 6;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  delay.connect(fb).connect(delay);

  osc.connect(g);
  g.connect(out);
  g.connect(delay).connect(out);
  osc.start(t);
  osc.stop(t + 0.55);
}

function scheduleStep(ctx: AudioContext, out: GainNode, s: number, t: number) {
  const bar = Math.floor(s / STEPS_PER_BAR);
  const pos = s % STEPS_PER_BAR;
  const chord = PROGRESSION[bar];

  if (pos === 0) pad(ctx, out, t, chord.pad);
  if (KICK_STEPS.includes(pos)) {
    kick(ctx, out, t);
    // Baixo acompanha o bumbo; na posição 10 sobe pra quinta
    bass(ctx, out, t, pos === 10 ? chord.bass * 1.5 : chord.bass);
  }
  if (HAT_STEPS.includes(pos)) hat(ctx, out, t, pos === 6);
  // Pluck esparso: 2º tempo dos compassos pares, nem sempre
  if (pos === 8 && bar % 2 === 1 && Math.random() < 0.75) pluck(ctx, out, t);
}

export function ambientPlaying(): boolean {
  return playing;
}

export function startAmbient() {
  if (playing) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  playing = true;
  master = buildMaster(ctx);
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(MASTER_LEVEL, ctx.currentTime + FADE_S);

  step = 0;
  nextTime = ctx.currentTime + 0.1;
  timer = setInterval(() => {
    if (!playing || !master) return;
    while (nextTime < ctx.currentTime + SCHEDULE_AHEAD) {
      scheduleStep(ctx, master, step, nextTime);
      nextTime += STEP_DUR;
      step = (step + 1) % TOTAL_STEPS;
    }
  }, LOOKAHEAD_MS);
}

export function stopAmbient() {
  if (!playing) return;
  playing = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const ctx = getAudioContext();
  if (ctx && master) {
    const m = master;
    m.gain.cancelScheduledValues(ctx.currentTime);
    m.gain.setValueAtTime(m.gain.value, ctx.currentTime);
    m.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    // desconecta após o fade para liberar os nós
    setTimeout(() => m.disconnect(), 1000);
  }
  master = null;
}
