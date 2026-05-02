import Link from "next/link";

const links = [
  { label: "Termos de Uso", href: "/termos" },
  { label: "Como funciona", href: "/liga" },
  { label: "Histórico de resoluções", href: "/historico" },
  { label: "Ranking", href: "/ranking" },
  { label: "Contato", href: "mailto:contato@zafe.com.br" },
];

export default function LandingFooter() {
  return (
    <footer className="border-t border-border/40 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="text-lg font-black text-primary">Zafe</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs text-muted-foreground hover:text-white transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="pt-2 border-t border-border/30 space-y-2 text-[11px] text-muted-foreground/50 leading-relaxed">
          <p>
            A Zafe é uma plataforma de competição de habilidade preditiva, operando
            sob a Lei 5.768/71. Z$ é moeda virtual sem valor monetário real. O prêmio
            mensal é destinado exclusivamente aos vencedores do concurso de previsões.
            Uso restrito a maiores de 18 anos.
          </p>
          <p>© {new Date().getFullYear()} Zafe. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
