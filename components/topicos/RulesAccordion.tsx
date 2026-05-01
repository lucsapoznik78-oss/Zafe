"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  description?: string | null;
  type?: "topico" | "desafio";
}

const topicoRules = [
  {
    q: "O que acontece se o evento não ocorrer?",
    a: "Se o evento não acontecer dentro do prazo definido, o resultado é NÃO e os apostadores desse lado recebem o prêmio.",
  },
  {
    q: "O que acontece se ninguém apostar no lado oposto?",
    a: "Se apenas um lado tiver apostas, todos recebem reembolso integral. Não há mercado sem cobertura.",
  },
  {
    q: "Como o resultado é determinado?",
    a: "Um oracle automático busca fontes oficiais ao encerrar o prazo. Se incerto, um admin da Zafe resolve manualmente.",
  },
  {
    q: "Qual a comissão cobrada?",
    a: "6% do valor total apostado — descontado proporcionalmente do prêmio de cada vencedor.",
  },
  {
    q: "Posso vender minha posição antes do encerramento?",
    a: "Sim, pelo mercado secundário (aba Vender) — coloque uma ordem de venda e outro usuário compra sua posição. Taxa de 6% sobre o valor da venda.",
  },
];

const desafioRules = [
  {
    q: "O que acontece se o evento não ocorrer?",
    a: "Se o evento não acontecer dentro do prazo definido, o resultado é NÃO e os apostadores desse lado recebem o prêmio.",
  },
  {
    q: "O que acontece se ninguém apostar no lado oposto?",
    a: "Se apenas um lado tiver apostas, todos recebem reembolso integral. Não há mercado sem cobertura.",
  },
  {
    q: "Como o resultado é determinado?",
    a: "Após o prazo, o criador do desafio envia uma prova do resultado (link, imagem ou vídeo). A prova é avaliada automaticamente por IA. Se aprovada, abre-se uma janela de 48h para contestação. Se rejeitada, o criador tem 24h para enviar uma nova prova.",
  },
  {
    q: "Qual a comissão cobrada?",
    a: "12% do valor total apostado — 6% para o criador do desafio e 6% para a plataforma — descontados proporcionalmente do prêmio de cada vencedor.",
  },
  {
    q: "Posso vender minha posição antes do encerramento?",
    a: "Sim, pelo mercado secundário (aba Vender) — coloque uma ordem de venda e outro usuário compra sua posição. Taxa de 6% sobre o valor da venda.",
  },
];

export default function RulesAccordion({ description, type = "topico" }: Props) {
  const genericRules = type === "desafio" ? desafioRules : topicoRules;
  const [open, setOpen] = useState(false);
  const [openItem, setOpenItem] = useState<number | null>(null);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
      >
        <span>Regras e cenários</span>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border/40 divide-y divide-border/20">
          {description && (
            <div className="px-4 py-3">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Critério de resolução</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            </div>
          )}
          {genericRules.map((rule, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenItem(openItem === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/3 transition-colors"
              >
                <span className="text-xs text-white pr-4">{rule.q}</span>
                <ChevronDown size={13} className={`text-muted-foreground shrink-0 transition-transform duration-150 ${openItem === i ? "rotate-180" : ""}`} />
              </button>
              {openItem === i && (
                <p className="px-4 pb-3 text-xs text-muted-foreground leading-relaxed">{rule.a}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
