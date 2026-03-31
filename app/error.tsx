"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
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
    <html lang="pt-BR">
      <body className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="text-8xl font-black text-nao/20">500</div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Algo deu errado</h1>
            <p className="text-muted-foreground">
              Ocorreu um erro inesperado. Já fomos notificados e estamos investigando.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground/50 font-mono">
                ID: {error.digest}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="px-6 py-2.5 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              Tentar novamente
            </button>
            <Link
              href="/topicos"
              className="px-6 py-2.5 bg-card border border-border text-white font-semibold rounded-lg hover:bg-card/80 transition-colors"
            >
              Ver mercados
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
