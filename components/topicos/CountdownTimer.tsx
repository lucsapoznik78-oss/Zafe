"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export default function CountdownTimer({ closesAt }: { closesAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function calc() {
      const diff = new Date(closesAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Encerrado"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`);
      else if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`);
      else setTimeLeft(`${m}m ${s}s`);
    }
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [closesAt]);

  const isUrgent = new Date(closesAt).getTime() - Date.now() < 3600000;

  return (
    <div className={`flex items-center gap-1.5 text-sm font-medium ${isUrgent ? "text-nao" : "text-muted-foreground"}`}>
      <Clock size={14} />
      <span>{timeLeft}</span>
    </div>
  );
}
