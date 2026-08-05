import type { Metadata } from "next";
import Link from "next/link";
import LegalFooter from "@/components/layout/LegalFooter";

export const metadata: Metadata = {
  title: "Todas as páginas | Zafe",
  description:
    "Índice de todas as páginas públicas da Zafe: eventos, ranking, concurso, transparência, documentos legais e contato.",
};

// Apenas rotas públicas (ver `publicRoutes` em middleware.ts). Páginas atrás de
// login não entram: apontar para elas daqui só geraria redirect para /login.
const SECOES = [
  {
    titulo: "Produto",
    paginas: [
      { href: "/", label: "Início", desc: "O que é a Zafe e como participar." },
      { href: "/liga", label: "Liga", desc: "Eventos abertos para previsão em Z$." },
      { href: "/concurso", label: "Concurso", desc: "A competição mensal com prêmio em R$." },
      { href: "/comunidade", label: "Comunidade", desc: "Eventos criados e resolvidos pelos usuários." },
      { href: "/ranking", label: "Ranking", desc: "Classificação geral dos previsores." },
      { href: "/games", label: "Games", desc: "Modos rápidos e desafios." },
    ],
  },
  {
    titulo: "Transparência",
    paginas: [
      { href: "/historico", label: "Histórico de resoluções", desc: "Como cada evento foi resolvido e com qual fonte." },
      { href: "/termos/historico", label: "Histórico dos Termos", desc: "Todas as versões publicadas, com data de vigência." },
      { href: "/ajuda", label: "Ajuda e Transparência", desc: "Suporte e tudo que a Zafe publica abertamente." },
    ],
  },
  {
    titulo: "Legal",
    paginas: [
      { href: "/termos", label: "Termos de Uso", desc: "Regras da plataforma e do Concurso." },
      { href: "/politica", label: "Política de Privacidade", desc: "Tratamento de dados pessoais e prazos de retenção." },
      { href: "/jogo-responsavel", label: "Jogo responsável", desc: "Limites, pausa, autoexclusão e onde buscar ajuda." },
      { href: "/contato", label: "Contato e Identificação", desc: "Quem opera a Zafe e por onde falar com a equipe." },
    ],
  },
];

export default function PaginasPage() {
  return (
    <div className="py-6 space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white">Todas as páginas</h1>
        <p className="text-sm text-muted-foreground">
          Índice das páginas públicas da Zafe, sem precisar de conta para navegar.
        </p>
      </div>

      {SECOES.map((secao) => (
        <section key={secao.titulo} className="space-y-3">
          <h2 className="text-lg font-bold text-white">{secao.titulo}</h2>
          <ul className="space-y-2">
            {secao.paginas.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  className="block bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/40 transition-colors"
                >
                  <p className="text-sm font-bold text-white">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.desc}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <LegalFooter />
    </div>
  );
}
