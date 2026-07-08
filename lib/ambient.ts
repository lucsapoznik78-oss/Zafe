// Música ambiente 100% digital — gerada em tempo real via Web Audio API,
// sem nenhum arquivo de áudio. Estilo: house/funk animado e otimista,
// 122 BPM, loop de 4 compassos em Dó maior (C → G → Am → F, a progressão
// "hino"), bumbo quatro-no-chão, palmas, baixo saltitante em oitavas e
// arpejo brilhante puxando pra cima. Energia de "bora jogar".

import { getAudioContext } from "@/lib/sound";

const BPM = 122;
const STEP_DUR = 60 / BPM / 4; // semicolcheia
const STEPS_PER_BAR = 16;
const BARS = 4;
const TOTAL_STEPS = BARS * STEPS_PER_BAR;
const LOOKAHEAD_MS = 100;
const SCHEDULE_AHEAD = 0.25; // segundos
const MASTER_LEVEL = 0.7;
const FADE_S = 1.2;

// Progressão I–V–vi–IV: baixo (root) + acorde (4 notas) + tons do arpejo
const PROGRESSION = [
  { bass: 130.81, chord: [261.63, 329.63, 392.0, 523.25], arp: [523.25, 659.25, 783.99, 1046.5] },  // C
  { bass: 98.0,   chord: [246.94, 293.66, 392.0, 493.88], arp: [493.88, 587.33, 783.99, 987.77] },  // G
  { bass: 110.0,  chord: [220.0, 261.63, 329.63, 440.0],  arp: [440.0, 523.25, 659.25, 880.0] },    // Am
  { bass: 87.31,  chord: [220.0, 261.63, 349.23, 440.0],  arp: [440.0, 523.25, 698.46, 880.0] },    // F
];

// Groove: bumbo quatro-no-chão, palma no 2 e 4, chimbal em colcheias
const KICK_STEPS = [0, 4, 8, 12];
const CLAP_STEPS = [4, 12];
const STAB_STEPS = [2, 7, 10]; // stabs sincopados de acorde (piano house)

let playing = false;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextTime = 0;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function buildMaster(ctx: AudioContext): GainNode {
  const gain = ctx.createGain();
  // Lowpass alto mantém o brilho mas tira aspereza digital
  const polish = ctx.createBiquadFilter();
  polish.type = "lowpass";
  polish.frequency.value = 6500;
  polish.Q.value = 0.5;
  gain.connect(polish).connect(ctx.destination);
  return gain;
}

function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(ctx.sampleRate * 0.2);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function kick(ctx: AudioContext, out: GainNode, t: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.1);
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.22);
}

function clap(ctx: AudioContext, out: GainNode, t: number) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1600;
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.07, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.14);
}

function hat(ctx: AudioContext, out: GainNode, t: number, open: boolean) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 8000;
  const g = ctx.createGain();
  const dur = open ? 0.12 : 0.04;
  g.gain.setValueAtTime(open ? 0.04 : 0.018, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(hp).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

// Baixo saltitante: root nos tempos, oitava acima nos contratempos
function bass(ctx: AudioContext, out: GainNode, t: number, freq: number) {
  const osc = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, t);
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(500, t);
  lp.frequency.exponentialRampToValueAtTime(220, t + STEP_DUR * 1.6);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.085, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + STEP_DUR * 1.8);
  osc.connect(lp).connect(g).connect(out);
  osc.start(t);
  osc.stop(t + STEP_DUR * 2);
}

// Stab de acorde estilo piano house — curto, brilhante, sincopado
function stab(ctx: AudioContext, out: GainNode, t: number, freqs: number[]) {
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.016, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.25);
  }
}

// Arpejo ascendente em colcheias — o "gancho" otimista, com eco
function arp(ctx: AudioContext, out: GainNode, t: number, freq: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);

  const delay = ctx.createDelay(1);
  delay.delayTime.value = STEP_DUR * 3;
  const fb = ctx.createGain();
  fb.gain.value = 0.28;
  delay.connect(fb).connect(delay);

  osc.connect(g);
  g.connect(out);
  g.connect(delay).connect(out);
  osc.start(t);
  osc.stop(t + 0.32);
}

function scheduleStep(ctx: AudioContext, out: GainNode, s: number, t: number) {
  const bar = Math.floor(s / STEPS_PER_BAR);
  const pos = s % STEPS_PER_BAR;
  const chord = PROGRESSION[bar];

  if (KICK_STEPS.includes(pos)) kick(ctx, out, t);
  if (CLAP_STEPS.includes(pos)) clap(ctx, out, t);
  // Chimbal em colcheias: fechado nos tempos, aberto nos contratempos
  if (pos % 2 === 0) hat(ctx, out, t, pos % 4 === 2);

  // Baixo em colcheias saltando de oitava (root ↔ oitava acima)
  if (pos % 2 === 0) {
    bass(ctx, out, t, pos % 4 === 0 ? chord.bass : chord.bass * 2);
  }

  if (STAB_STEPS.includes(pos)) stab(ctx, out, t, chord.chord);

  // Arpejo sobe pelo acorde na segunda metade do compasso (colcheias)
  if (pos >= 8 && pos % 2 === 0) {
    arp(ctx, out, t, chord.arp[(pos - 8) / 2]);
  }
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
    m.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    // desconecta após o fade para liberar os nós
    setTimeout(() => m.disconnect(), 700);
  }
  master = null;
}
