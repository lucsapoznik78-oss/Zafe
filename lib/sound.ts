// Camada de som da Zafe — efeitos sintetizados via Web Audio API (zero assets)
// e preferências persistidas em localStorage.
//
// Segue o "Zafe Stings" (zafe-sound-pack3): 8 efeitos de um disparo,
// portados de Tone.js para Web Audio puro. Sem música de fundo.
//
// Regras:
// - SFX ligados por padrão (mutável no SoundMenu do Navbar)
// - Nunca toca nada se o AudioContext não estiver liberado por gesto do usuário
//   (política de autoplay dos browsers)

const SFX_KEY = "zafe_sfx";

let ctx: AudioContext | null = null;
let unlocked = false;

export function sfxEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SFX_KEY) !== "off";
}

export function setSfxEnabled(on: boolean) {
  localStorage.setItem(SFX_KEY, on ? "on" : "off");
}

/** AudioContext compartilhado entre os SFX */
export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

const getCtx = getAudioContext;

/**
 * Libera o AudioContext no primeiro gesto do usuário (click/touch/tecla).
 * Chamado uma vez pelo SoundMenu ao montar. Idempotente.
 */
export function unlockAudioOnGesture() {
  if (typeof window === "undefined" || unlocked) return;
  unlocked = true;
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

interface ToneOpts {
  freq: number;
  /** segundos a partir de agora */
  at?: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  /** desliza a frequência até este valor ao final */
  glideTo?: number;
}

function tone(c: AudioContext, { freq, at = 0, duration = 0.15, type = "sine", gain = 0.08, glideTo }: ToneOpts) {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
  // envelope: ataque rápido, decaimento exponencial (evita cliques)
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Sino estilo FM (harmonicity 3): fundamental + parcial em 3x, decaimento longo */
function bell(c: AudioContext, freq: number, at = 0, gain = 0.08, duration = 0.5) {
  tone(c, { freq, at, duration, type: "sine", gain });
  tone(c, { freq: freq * 3, at, duration: duration * 0.6, type: "sine", gain: gain * 0.25 });
}

/** Whoosh de ruído branco com bandpass varrendo `from` → `to` */
function whoosh(c: AudioContext, from: number, to: number, duration = 0.45, gain = 0.05) {
  const t0 = c.currentTime;
  const len = Math.ceil(c.sampleRate * (duration + 0.1));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + duration);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.1);
}

// Frequências (Hz)
const C4 = 261.63, E4 = 329.63, G4 = 392.0;
const C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880.0, B5 = 987.77;
const C6 = 1046.5, D6 = 1174.66, E6 = 1318.51, G6 = 1567.98, C7 = 2093.0;
const G3 = 196.0, E3 = 164.81, Db3 = 138.59;

function ready(): AudioContext | null {
  if (!sfxEnabled()) return null;
  const c = getCtx();
  if (!c || c.state !== "running") return null;
  return c;
}

/** Tique sutil — últimos segundos do countdown (fora do pack, utilitário) */
export function playTick() {
  const c = ready();
  if (!c) return;
  tone(c, { freq: 1800, duration: 0.05, type: "sine", gain: 0.04 });
}

/** "Entrar no evento" — whoosh + acorde que abre */
export function playJoin() {
  const c = ready();
  if (!c) return;
  whoosh(c, 300, 5000, 0.45);
  [C4, G4, C5].forEach((f) => tone(c, { freq: f, at: 0.35, duration: 0.8, type: "triangle", gain: 0.05 }));
}

/** "Palpite enviado" — chime curto de confirmação (sino C5 → G5) */
export function playConfirm() {
  const c = ready();
  if (!c) return;
  bell(c, C5, 0, 0.08, 0.18);
  bell(c, G5, 0.09, 0.08, 0.35);
}

/** "Acerto" — ding ascendente brilhante C5-E5-G5-C6 + sino */
export function playWin() {
  const c = ready();
  if (!c) return;
  [C5, E5, G5, C6].forEach((f, i) =>
    tone(c, { freq: f, at: i * 0.06, duration: 0.18, type: "triangle", gain: 0.09 })
  );
  bell(c, C6, 0.26, 0.05, 0.4);
}

/** "Erro" — womp descendente em serra, leve, sem punir demais */
export function playWrong() {
  const c = ready();
  if (!c) return;
  tone(c, { freq: G3, duration: 0.2, type: "sawtooth", gain: 0.07, glideTo: E3 });
  tone(c, { freq: E3, at: 0.12, duration: 0.2, type: "sawtooth", gain: 0.07, glideTo: Db3 });
  tone(c, { freq: Db3, at: 0.24, duration: 0.45, type: "sawtooth", gain: 0.07, glideTo: Db3 * 0.94 });
}

/** "Sequência" — blips de moeda subindo (combo / acertos em sequência) */
export function playStreak() {
  const c = ready();
  if (!c) return;
  [C5, E5, G5, B5, D6, G6].forEach((f, i) =>
    tone(c, { freq: f, at: i * 0.05, duration: 0.1, type: "square", gain: 0.05 })
  );
}

/** "Subiu de rank" — fanfarra rápida: arpejo + acorde + sinos */
export function playRankUp() {
  const c = ready();
  if (!c) return;
  [G4, C5, E5].forEach((f, i) =>
    tone(c, { freq: f, at: i * 0.08, duration: 0.15, type: "triangle", gain: 0.07 })
  );
  [C5, E5, G5, C6].forEach((f) => tone(c, { freq: f, at: 0.28, duration: 0.8, type: "triangle", gain: 0.06 }));
  bell(c, E6, 0.3, 0.05, 0.5);
  bell(c, G6, 0.45, 0.04, 0.5);
}

/** "Prêmio" — cascata de moedas + acorde final com sinos */
export function playJackpot() {
  const c = ready();
  if (!c) return;
  const cascata = [C6, E6, G6, C7, E6, G6];
  for (let i = 0; i < 10; i++) {
    tone(c, { freq: cascata[i % 6], at: i * 0.045, duration: 0.09, type: "square", gain: 0.05 });
  }
  [C4, E4, G4, C5, E5].forEach((f) => tone(c, { freq: f, at: 0.5, duration: 1.2, type: "triangle", gain: 0.05 }));
  bell(c, C6, 0.5, 0.05, 0.8);
  bell(c, G6, 0.65, 0.04, 0.8);
}

/** "Notificação" — ping gentil de 2 notas (E5 → A5) */
export function playNotify() {
  const c = ready();
  if (!c) return;
  bell(c, E5, 0, 0.06, 0.18);
  bell(c, A5, 0.12, 0.06, 0.35);
}
