import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-8xl font-black text-primary/20">404</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Página não encontrada</h1>
          <p className="text-muted-foreground">
            Esse evento pode ter sido removido ou o link está errado.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/liga"
            className="px-6 py-2.5 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            Ver eventos
          </Link>
          <Link
            href="/"
            className="px-6 py-2.5 bg-card border border-border text-white font-semibold rounded-lg hover:bg-card/80 transition-colors"
          >
            Início
          </Link>
        </div>
      </div>
    </div>
  );
}
