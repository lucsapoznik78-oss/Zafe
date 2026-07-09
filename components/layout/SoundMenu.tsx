"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { sfxEnabled, setSfxEnabled, unlockAudioOnGesture, playConfirm } from "@/lib/sound";

export default function SoundMenu() {
  const [sfx, setSfx] = useState(true);

  // Preferência só existe no client — lê após montar (evita mismatch de hydration).
  useEffect(() => {
    setSfx(sfxEnabled());
    unlockAudioOnGesture();
  }, []);

  function toggleSfx() {
    const next = !sfx;
    setSfx(next);
    setSfxEnabled(next);
    if (next) playConfirm(); // feedback imediato ao religar
  }

  return (
    <button
      onClick={toggleSfx}
      title={sfx ? "Desligar efeitos sonoros" : "Ligar efeitos sonoros"}
      className="relative p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
    >
      {sfx ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
  );
}
