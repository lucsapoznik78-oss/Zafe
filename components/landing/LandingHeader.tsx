import Link from "next/link";

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-black/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-black text-primary tracking-tight">
          Zafe
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/liga"
            className="hidden sm:inline-flex px-3 py-1.5 text-sm text-muted-foreground hover:text-white transition-colors"
          >
            Ver eventos
          </Link>
          <Link
            href="/login"
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-white transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="/concurso/entrar"
            className="px-4 py-1.5 rounded-lg bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Criar conta
          </Link>
        </nav>
      </div>
    </header>
  );
}
