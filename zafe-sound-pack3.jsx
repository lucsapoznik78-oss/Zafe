import React, { useState, useRef, useEffect, useCallback } from "react";
import * as Tone from "tone";
import { Volume2, VolumeX, Check, X, TrendingUp, Award, Gift, Bell, LogIn, Send } from "lucide-react";

// ============================================================
//  ZAFE — Stings Pack
//  8 efeitos de um disparo. Tocam por cima de qualquer loop.
// ============================================================

const GOLD = "#FFB800";
const GREEN = "#00C896";
const RED = "#E74C3C";
const BG = "#0F1419";

const STINGS = [
  { id: "join", name: "Entrar no evento", icon: LogIn, color: "#3498DB", desc: "Whoosh + acorde que abre. Ao entrar numa liga/mercado." },
  { id: "bet", name: "Palpite enviado", icon: Send, color: GREEN, desc: "Chime curto de confirmacao. Ao fechar um palpite." },
  { id: "correct", name: "Acerto", icon: Check, color: GREEN, desc: "Ding ascendente brilhante. Palpite certo / ganhou pontos." },
  { id: "wrong", name: "Erro", icon: X, color: RED, desc: "Womp descendente. Palpite errado — leve, sem punir demais." },
  { id: "streak", name: "Sequencia", icon: TrendingUp, color: GOLD, desc: "Blips subindo. Combo / acertos em sequencia." },
  { id: "rankup", name: "Subiu de rank", icon: Award, color: "#9B59B6", desc: "Fanfarra rapida. Ferro -> Bronze -> ... -> Mestre." },
  { id: "jackpot", name: "Premio", icon: Gift, color: GOLD, desc: "Cascata de moedas + hit. Ganhou o R$500 / Z$ grande." },
  { id: "notify", name: "Notificacao", icon: Bell, color: "#3498DB", desc: "Ping gentil de 2 notas. Novo evento / resultado saiu." },
];

export default function ZafeStings() {
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(null);
  const [vol, setVol] = useState(0.5);
  const [muted, setMuted] = useState(false);

  const S = useRef(null); // instrumentos de sting
  const analyser = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const peaks = useRef([]);
  const flashCol = useRef(GOLD);

  useEffect(() => {
    if (!ready) return;
    Tone.getDestination().volume.rampTo(muted ? -Infinity : Tone.gainToDb(vol), 0.15);
  }, [vol, muted, ready]);

  const initAudio = useCallback(async () => {
    if (ready) return;
    await Tone.start();
    const a = new Tone.Analyser("fft", 64);
    Tone.getDestination().connect(a);
    analyser.current = a;
    Tone.getDestination().volume.value = Tone.gainToDb(vol);

    const verb = new Tone.Reverb({ decay: 2.2, wet: 0.28 }).toDestination();
    const delay = new Tone.FeedbackDelay("16n", 0.2).connect(verb);
    const poly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.004, decay: 0.2, sustain: 0.1, release: 0.3 }, volume: -8,
    }).connect(verb);
    const coin = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.05 }, volume: -12,
    }).connect(delay);
    const bell = new Tone.FMSynth({
      harmonicity: 3, modulationIndex: 8,
      envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.6 }, volume: -12,
    }).connect(verb);
    const womp = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" }, portamento: 0.08,
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.2 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.1, baseFrequency: 200, octaves: 2 },
      volume: -10,
    }).connect(verb);
    const nzF = new Tone.Filter(400, "bandpass");
    const noise = new Tone.NoiseSynth({
      noise: { type: "white" }, envelope: { attack: 0.05, decay: 0.4, sustain: 0 }, volume: -16,
    }).connect(nzF);
    nzF.connect(verb);
    S.current = { verb, delay, poly, coin, bell, womp, noise, nzF };

    setReady(true);
  }, [ready, vol]);

  const playSting = useCallback(async (id, color) => {
    await initAudio();
    const s = S.current; const n = Tone.now();
    flashCol.current = color || GOLD;
    setFlash(id); setTimeout(() => setFlash(null), 300);
    switch (id) {
      case "join": {
        s.nzF.frequency.setValueAtTime(300, n);
        s.nzF.frequency.rampTo(5000, 0.45, n);
        s.noise.triggerAttackRelease("4n", n, 0.6);
        s.poly.triggerAttackRelease(["C4", "G4", "C5"], "2n", n + 0.35, 0.5);
        break;
      }
      case "bet": {
        s.bell.triggerAttackRelease("C5", "16n", n, 0.7);
        s.bell.triggerAttackRelease("G5", "8n", n + 0.09, 0.7);
        break;
      }
      case "correct": {
        ["C5", "E5", "G5", "C6"].forEach((note, i) => s.poly.triggerAttackRelease(note, "16n", n + i * 0.06, 0.8));
        s.bell.triggerAttackRelease("C6", "8n", n + 0.26, 0.4);
        break;
      }
      case "wrong": {
        s.womp.triggerAttackRelease("G3", "8n", n, 0.9);
        s.womp.triggerAttackRelease("E3", "8n", n + 0.12, 0.9);
        s.womp.triggerAttackRelease("Db3", "4n", n + 0.24, 0.9);
        break;
      }
      case "streak": {
        ["C5", "E5", "G5", "B5", "D6", "G6"].forEach((note, i) => s.coin.triggerAttackRelease(note, "16n", n + i * 0.05, 0.8));
        break;
      }
      case "rankup": {
        ["G4", "C5", "E5"].forEach((note, i) => s.poly.triggerAttackRelease(note, "16n", n + i * 0.08, 0.7));
        s.poly.triggerAttackRelease(["C5", "E5", "G5", "C6"], "2n", n + 0.28, 0.7);
        s.bell.triggerAttackRelease("E6", "4n", n + 0.3, 0.5);
        s.bell.triggerAttackRelease("G6", "4n", n + 0.45, 0.4);
        break;
      }
      case "jackpot": {
        for (let i = 0; i < 10; i++) {
          const note = ["C6", "E6", "G6", "C7", "E6", "G6"][i % 6];
          s.coin.triggerAttackRelease(note, "32n", n + i * 0.045, 0.7);
        }
        s.poly.triggerAttackRelease(["C4", "E4", "G4", "C5", "E5"], "1n", n + 0.5, 0.6);
        s.bell.triggerAttackRelease("C6", "2n", n + 0.5, 0.5);
        s.bell.triggerAttackRelease("G6", "2n", n + 0.65, 0.4);
        break;
      }
      case "notify": {
        s.bell.triggerAttackRelease("E5", "16n", n, 0.6);
        s.bell.triggerAttackRelease("A5", "8n", n + 0.12, 0.6);
        break;
      }
      default: break;
    }
  }, [initAudio]);

  // ---------- visualizador (reage aos stings) ----------
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const col = flash ? flashCol.current : "#2a3138";
      const N = 40;
      if (analyser.current) {
        const data = analyser.current.getValue();
        const bw = w / N;
        for (let i = 0; i < N; i++) {
          const raw = data[i] ?? -140;
          let v = (raw + 140) / 140; v = Math.max(0, Math.min(1, v)); v = Math.pow(v, 1.6) * 2.2;
          const bh = Math.min(h, v * h);
          if (!peaks.current[i] || bh > peaks.current[i]) peaks.current[i] = bh;
          else peaks.current[i] = Math.max(bh, peaks.current[i] - 2.5);
          const x = i * bw + 1;
          const grad = ctx.createLinearGradient(0, h, 0, h - bh);
          grad.addColorStop(0, col + "55"); grad.addColorStop(1, col);
          ctx.fillStyle = grad; ctx.fillRect(x, h - bh, bw - 2, bh);
          ctx.fillStyle = col; ctx.fillRect(x, h - peaks.current[i] - 2, bw - 2, 2);
        }
      }
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [flash]);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: BG, color: "#E8EDF2", minHeight: "100%", padding: "28px 22px", borderRadius: 16 }}>
      <style>{`
        .sting { transition: all .12s ease; } .sting:hover { transform: translateY(-3px); }
        input[type=range]{ -webkit-appearance:none; height:4px; border-radius:4px; background:#2a3138; outline:none; }
        input[type=range]::-webkit-slider-thumb{ -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:${GOLD}; cursor:pointer; }
      `}</style>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Zafe</span>
        <span style={{ color: GOLD, fontSize: 22, fontWeight: 800 }}>Stings</span>
      </div>
      <p style={{ margin: "0 0 16px", color: "#7d8894", fontSize: 13 }}>8 efeitos de um disparo. Feitos pra tocar por cima de qualquer loop de fundo.</p>

      <div style={{ background: "#0a0e12", borderRadius: 12, padding: 8, marginBottom: 18, border: "1px solid #1b2228" }}>
        <canvas ref={canvasRef} width={620} height={64} style={{ width: "100%", height: 64, display: "block" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {STINGS.map((s) => {
          const Icon = s.icon; const lit = flash === s.id;
          return (
            <button key={s.id} className="sting" onClick={() => playSting(s.id, s.color)}
              style={{ textAlign: "left", background: lit ? s.color + "22" : "#111820", border: `1px solid ${lit ? s.color : "#1b2228"}`, borderRadius: 12, padding: "11px 12px", cursor: "pointer", color: "#E8EDF2", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, background: s.color + "1e", display: "grid", placeItems: "center", color: s.color }}><Icon size={17} /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 13 }}>{s.name}</span>
                <span style={{ display: "block", fontSize: 11, color: "#8a95a1", lineHeight: 1.35, marginTop: 2 }}>{s.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, background: "#111820", border: "1px solid #1b2228", borderRadius: 12, padding: "10px 14px" }}>
        <button onClick={() => setMuted((m) => !m)} style={{ background: "none", border: "none", color: "#8a95a1", cursor: "pointer", display: "grid", placeItems: "center" }}>
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <input type="range" min={0} max={1} step={0.01} value={vol} onChange={(e) => { setVol(parseFloat(e.target.value)); if (muted) setMuted(false); }} style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "#5c6670", width: 34, textAlign: "right" }}>{Math.round(vol * 100)}%</span>
      </div>
    </div>
  );
}
