import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  HeartHandshake,
  History,
  Lock,
  MessagesSquare,
  ScrollText,
} from "lucide-react";
import LegalFooter from "@/components/layout/LegalFooter";

export const metadata: Metadata = {
  title: "Ajuda e Transparência | Zafe",
  description:
    "Fale com a equipe Zafe, veja como cada evento foi resolvido, consulte as versões dos Termos, a Política de Privacidade e as ferramentas de jogo responsável.",
};

const TRANSPARENCIA = [
  {
    href: "/historico",
    icon: History,
    title: "Histórico de resoluções",
    description: "Como cada evento foi resolvido, com a fonte usada na decisão.",
  },
  {
    href: "/termos/historico",
    icon: ScrollText,
    title: "Histórico dos Termos",
    description: "Todas as versões já publicadas dos Termos de Uso, com data de vigência.",
  },
  {
    href: "/jogo-responsavel",
    icon: HeartHandshake,
    title: "Jogo responsável",
    description: "Limites de uso, pausa, autoexclusão e onde buscar ajuda.",
  },
];

const LEGAL = [
  {
    href: "/termos",
    icon: FileText,
    title: "Termos de Uso",
    description: "Regras da plataforma e do Concurso.",
  },
  {
    href: "/politica",
    icon: Lock,
    title: "Política de Privacidade",
    description: "Tratamento de dados pessoais, bases legais e prazos de retenção.",
  },
];

function CardLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof FileText;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 bg-card border border-border rounded-xl px-4 py-3.5 hover:border-primary/40 transition-colors"
    >
      <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
    </Link>
  );
}

export default function AjudaPage() {
  return (
    <div className="py-6 space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-foreground">Ajuda e Transparência</h1>
        <p className="text-sm text-muted-foreground">
          Suporte direto com a equipe e tudo que a Zafe publica abertamente sobre como a
          plataforma funciona.
        </p>
      </div>

      {/* Suporte — o caminho principal, em destaque */}
      <Link
        href="/canal"
        className="group flex items-start gap-3 bg-primary/5 border border-primary/30 rounded-xl px-5 py-4 hover:border-primary/60 transition-colors"
      >
        <MessagesSquare className="w-6 h-6 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-foreground">Canal do Usuário</p>
          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
            Sua linha direta com a equipe Zafe. Abra uma conversa sobre previsões, conta, Z$
            ou o Concurso e acompanhe a resposta por aqui mesmo.
          </p>
        </div>
        <ArrowRight className="w-5 h-5 text-primary/60 shrink-0 mt-1 group-hover:text-primary transition-colors" />
      </Link>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Transparência</h2>
          <p className="text-xs text-muted-foreground">
            Nada de caixa-preta: o histórico de decisões e de regras fica público.
          </p>
        </div>
        <div className="space-y-2">
          {TRANSPARENCIA.map((item) => (
            <CardLink key={item.href} {...item} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Legal</h2>
          <p className="text-xs text-muted-foreground">
            Os documentos que regem sua participação na plataforma.
          </p>
        </div>
        <div className="space-y-2">
          {LEGAL.map((item) => (
            <CardLink key={item.href} {...item} />
          ))}
        </div>
      </section>

      <LegalFooter />
    </div>
  );
}
