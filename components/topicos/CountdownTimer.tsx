"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";

export default function CountdownTimer({ closesAt }: { closesAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    function calc() {
      const diff = new Date(closesAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Encerrado");
        setIsClosed(true);
        setIsUrgent(false);
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setIsUrgent(diff < 3600000);
      if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`);
      else if (h > 0) setTimeLeft(`encerra em ${h}h ${m}m ${s}s`);
      else setTimeLeft(`encerra em ${m}m ${s}s`);
    }
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [closesAt]);

  if (isClosed) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock size={13} />
        <span>Encerrado</span>
      </div>
    );
  }

  if (isUrgent) {
    return (
      <div className="flex items-center gap-1.5 text-sm font-bold text-nao animate-pulse">
        <AlertTriangle size={14} />
        <span>{timeLeft}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <Clock size={13} />
      <span>{timeLeft}</span>
    </div>
  );
}
