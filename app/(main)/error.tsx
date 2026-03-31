"use client";

import { useEffect } from "react";

export default function MainLayoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-6 text-center">
      <div className="w-16 h-16 rounded-full bg-nao/10 flex items-center justify-center">
        <span className="text-2xl">⚠️</span>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-white">Algo deu errado</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Não conseguimos carregar essa página. Tente novamente ou volte mais tarde.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/50 font-mono">
            ID: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="px-5 py-2 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm"
      >
        Tentar novamente
      </button>
    </div>
  );
}
