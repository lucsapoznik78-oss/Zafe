import type { Metadata } from "next";
import Link from "next/link";
// lucide não tem mais ícones de marca — o @ representa o perfil do Instagram.
import { AtSign, Building2, Mail, MessagesSquare } from "lucide-react";
import LegalFooter from "@/components/layout/LegalFooter";

export const metadata: Metadata = {
  title: "Contato e Identificação | Zafe",
  description:
    "Dados de identificação da Zafe, canais de atendimento, prazo de resposta e direito de arrependimento, conforme o Decreto 7.962/2013.",
};

// Identificação exigida pelo Art. 2º, I e II do Decreto 7.962/2013.
// Enquanto a constituição da empresa não estiver concluída, os campos abaixo
// ficam nulos e a seção correspondente não é renderizada — publicar um CNPJ ou
// endereço incorreto é pior do que ainda não publicá-lo.
const EMPRESA = {
  nome: null as string | null,
  cnpj: null as string | null,
  endereco: null as string | null,
};

const EMAIL = "contato@zafe.app";
const INSTAGRAM = "https://www.instagram.com/zafe.app.br";

export default function ContatoPage() {
  const temIdentificacao = !!(EMPRESA.nome && EMPRESA.cnpj && EMPRESA.endereco);

  return (
    <div className="py-6 space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white">Contato e Identificação</h1>
        <p className="text-sm text-muted-foreground">
          Quem opera a Zafe, por onde falar com a gente e em quanto tempo você recebe resposta.
        </p>
      </div>

      {temIdentificacao && (
        <section className="bg-card border border-border rounded-xl px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary shrink-0" />
            <h2 className="text-base font-bold text-white">Identificação do fornecedor</h2>
          </div>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Nome empresarial</dt>
              <dd className="text-white">{EMPRESA.nome}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">CNPJ</dt>
              <dd className="text-white">{EMPRESA.cnpj}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Endereço</dt>
              <dd className="text-white">{EMPRESA.endereco}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Endereço eletrônico</dt>
              <dd>
                <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">
                  {EMAIL}
                </a>
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-white">Canais de atendimento</h2>
          <p className="text-xs text-muted-foreground">
            Toda demanda recebe confirmação de recebimento e resposta em até 5 dias, conforme o
            Art. 4º do Decreto 7.962/2013.
          </p>
        </div>

        <Link
          href="/canal"
          className="group flex items-start gap-3 bg-primary/5 border border-primary/30 rounded-xl px-5 py-4 hover:border-primary/60 transition-colors"
        >
          <MessagesSquare className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-white">Canal do Usuário</p>
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
              O caminho mais rápido para quem já tem conta: abre uma conversa com a equipe e o
              histórico fica registrado no seu perfil.
            </p>
          </div>
        </Link>

        <a
          href={`mailto:${EMAIL}`}
          className="flex items-start gap-3 bg-card border border-border rounded-xl px-4 py-3.5 hover:border-primary/40 transition-colors"
        >
          <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">E-mail</p>
            <p className="text-xs text-muted-foreground mt-0.5">{EMAIL}</p>
          </div>
        </a>

        <a
          href={INSTAGRAM}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 bg-card border border-border rounded-xl px-4 py-3.5 hover:border-primary/40 transition-colors"
        >
          <AtSign className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Instagram</p>
            <p className="text-xs text-muted-foreground mt-0.5">@zafe.app.br</p>
          </div>
        </a>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">Cancelamento e arrependimento</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A Zafe é gratuita. As únicas cobranças em R$ são a assinatura Premium e, no futuro, a
          inscrição no Concurso — nunca há depósito, e Z$ não é comprado nem convertido em dinheiro.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Você pode desistir de qualquer contratação em até 7 dias corridos, contados da assinatura
          ou do pagamento, com devolução integral do valor (Art. 49 do CDC e Art. 5º do Decreto
          7.962/2013). Basta pedir por qualquer um dos canais acima — o cancelamento é feito pelo
          mesmo meio da contratação, sem custo.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-white">Privacidade e dados pessoais</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Pedidos de acesso, correção, portabilidade ou exclusão de dados (LGPD) também entram pelos
          canais acima. Os detalhes de tratamento estão na{" "}
          <Link href="/politica" className="text-primary hover:underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </section>

      <LegalFooter />
    </div>
  );
}
