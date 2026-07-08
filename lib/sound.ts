// Camada de som da Zafe — efeitos sintetizados via Web Audio API (zero assets)
// e preferências persistidas em localStorage.
//
// Regras:
// - SFX ligados por padrão (mutável no SoundMenu do Navbar)
// - Música ambiente DESLIGADA por padrão (opt-in), 100% sintetizada em lib/ambient.ts
// - Nunca toca nada se o AudioContext não estiver liberado por gesto do usuário
//   (política de autoplay dos browsers)

const SFX_KEY = "zafe_sfx";
const MUSIC_KEY = "zafe_music";

let ctx: AudioContext | null = null;
let unlocked = false;

export function sfxEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SFX_KEY) !== "off";
}

export function setSfxEnabled(on: boolean) {
  localStorage.setItem(SFX_KEY, on ? "on" : "off");
}

export function musicEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUSIC_KEY) === "on";
}

export function setMusicEnabled(on: boolean) {
  localStorage.setItem(MUSIC_KEY, on ? "on" : "off");
}

/** AudioContext compartilhado entre SFX e a música ambiente gerada */
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

function ready(): AudioContext | null {
  if (!sfxEnabled()) return null;
  const c = getCtx();
  if (!c || c.state !== "running") return null;
  return c;
}

/** Tique sutil — últimos segundos do countdown */
export function playTick() {
  const c = ready();
  if (!c) return;
  tone(c, { freq: 1800, duration: 0.05, type: "sine", gain: 0.04 });
}

/** Palpite registrado — duas notas ascendentes curtas */
export function playConfirm() {
  const c = ready();
  if (!c) return;
  tone(c, { freq: 523.25, duration: 0.12, type: "triangle", gain: 0.09 }); // C5
  tone(c, { freq: 783.99, at: 0.1, duration: 0.18, type: "triangle", gain: 0.09 }); // G5
}

/** Vitória — arpejo dourado C5-E5-G5-C6 com brilho */
export function playWin() {
  const c = ready();
  if (!c) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    tone(c, { freq: f, at: i * 0.11, duration: 0.35, type: "triangle", gain: 0.09 });
    // camada de brilho uma oitava acima, bem baixa
    tone(c, { freq: f * 2, at: i * 0.11, duration: 0.3, type: "sine", gain: 0.02 });
  });
  // nota final sustentada
  tone(c, { freq: 1046.5, at: 0.44, duration: 0.7, type: "sine", gain: 0.05 });
}
