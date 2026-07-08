"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Music, Sparkles, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  musicEnabled,
  setMusicEnabled,
  sfxEnabled,
  setSfxEnabled,
  unlockAudioOnGesture,
} from "@/lib/sound";

const AMBIENT_SRC = "/audio/zafe-ambient.mp3";
const AMBIENT_VOLUME = 0.22;
const FADE_MS = 2000;

export default function SoundMenu() {
  const [music, setMusic] = useState(false);
  const [sfx, setSfx] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Preferências só existem no client — lê após montar (evita mismatch de hydration)
  useEffect(() => {
    setMusic(musicEnabled());
    setSfx(sfxEnabled());
    unlockAudioOnGesture();
  }, []);

  function stopFade() {
    if (fadeRef.current) {
      clearInterval(fadeRef.current);
      fadeRef.current = null;
    }
  }

  function fadeIn(audio: HTMLAudioElement) {
    stopFade();
    audio.volume = 0;
    const step = AMBIENT_VOLUME / (FADE_MS / 100);
    fadeRef.current = setInterval(() => {
      audio.volume = Math.min(AMBIENT_VOLUME, audio.volume + step);
      if (audio.volume >= AMBIENT_VOLUME) stopFade();
    }, 100);
  }

  function startMusic() {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(AMBIENT_SRC);
      audio.loop = true;
      audio.addEventListener("error", () => {
        // Arquivo ausente — falha silenciosa (dev: adicione public/audio/zafe-ambient.mp3)
        console.warn("[zafe] música ambiente indisponível:", AMBIENT_SRC);
      });
      audioRef.current = audio;
    }
    audio.play().then(() => fadeIn(audio!)).catch(() => {});
  }

  function stopMusic() {
    stopFade();
    audioRef.current?.pause();
  }

  // Pausa quando a aba perde o foco, retoma ao voltar
  useEffect(() => {
    function onVisibility() {
      if (!audioRef.current) return;
      if (document.hidden) {
        audioRef.current.pause();
      } else if (musicEnabled()) {
        audioRef.current.play().catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopFade();
      audioRef.current?.pause();
    };
  }, []);

  function toggleMusic() {
    const next = !music;
    setMusic(next);
    setMusicEnabled(next);
    if (next) startMusic();
    else stopMusic();
  }

  function toggleSfx() {
    const next = !sfx;
    setSfx(next);
    setSfxEnabled(next);
  }

  const anyOn = music || sfx;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
        {anyOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card border-border">
        <DropdownMenuItem onClick={toggleMusic} className="cursor-pointer justify-between">
          <span className="flex items-center gap-2 text-sm">
            <Music size={14} className={music ? "text-primary" : "text-muted-foreground"} />
            Música ambiente
          </span>
          {music && <Check size={14} className="text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleSfx} className="cursor-pointer justify-between">
          <span className="flex items-center gap-2 text-sm">
            <Sparkles size={14} className={sfx ? "text-primary" : "text-muted-foreground"} />
            Efeitos sonoros
          </span>
          {sfx && <Check size={14} className="text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
