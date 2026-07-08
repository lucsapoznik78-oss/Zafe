"use client";

import { useEffect, useState } from "react";
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
import { startAmbient, stopAmbient } from "@/lib/ambient";

export default function SoundMenu() {
  const [music, setMusic] = useState(false);
  const [sfx, setSfx] = useState(true);

  // Preferências só existem no client — lê após montar (evita mismatch de hydration).
  useEffect(() => {
    setMusic(musicEnabled());
    setSfx(sfxEnabled());
    unlockAudioOnGesture();

    // Autoplay é bloqueado sem gesto: se a música estava ligada, retoma no
    // primeiro clique/toque da sessão.
    function resume() {
      if (musicEnabled()) startAmbient();
    }
    window.addEventListener("pointerdown", resume, { once: true });
    return () => {
      window.removeEventListener("pointerdown", resume);
      stopAmbient();
    };
  }, []);

  // Pausa quando a aba perde o foco, retoma ao voltar
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        stopAmbient();
      } else if (musicEnabled()) {
        startAmbient();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  function toggleMusic() {
    const next = !music;
    setMusic(next);
    setMusicEnabled(next);
    if (next) startAmbient();
    else stopAmbient();
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
