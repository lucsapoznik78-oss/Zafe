import type { Metadata } from "next";
import Link from "next/link";
import {
  Trophy,
  Ticket,
  Coins,
  TrendingUp,
  Crown,
  Scale,
  Banknote,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Como funciona o Concurso — Zafe",
  description:
    "Manual do Concurso Mensal Zafe: inscrição, ZC$, ranking e como a premiação em dinheiro é distribuída.",
  alternates: { canonical: "/concurso/como-funciona" },
};

const PASSOS = [
  {
    icon: Ticket,
    titulo: "1. Faça sua inscrição",
    texto:
      "A inscrição no concurso custa R$ 20 por edição (edições promocionais podem ser gratuitas). Para participar você precisa ter 18 anos ou mais e verificar sua identidade (CPF). Ao entrar, você recebe ZC$ 1.000 — os zafes do concurso — para usar durante o mês.",
  },
  {
    icon: Coins,
    titulo: "2. Entenda o ZC$",
    texto:
      "ZC$ é a moeda exclusiva do concurso. Ela é separada do seu saldo Z$ do resto da Zafe, não pode ser comprada e zera ao fim de cada edição. Todo mundo começa igual: ZC$ 1.000. O que muda sua posição é só a qualidade dos seus palpites.",
  },
  {
    icon: TrendingUp,
    titulo: "3. Faça seus palpites",
    texto:
      "Escolha os eventos do concurso (esportes, e-sports e mais) e diga o que você acha que vai acontecer, definindo quantos ZC$ quer colocar em cada previsão. O pool de cada evento é distribuído 100% entre quem acertou — a Zafe não fica com nada.",
  },
  {
    icon: Crown,
    titulo: "4. Suba no ranking",
    texto:
      "O ranking é simples: quem termina o mês com mais ZC$ fica na frente. Cada palpite certo aumenta seu saldo; cada erro diminui. No fim do período, as primeiras posições ganham prêmios reais em dinheiro.",
  },
];

export default function ComoFuncionaPage() {
  return (
    <div className="py-10 max-w-3xl mx-auto space-y-10 px-4">
      {/* Header */}
      <div>
        <Link
          href="/concurso"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors mb-5"
        >
          <ArrowLeft size={15} />
          Voltar ao concurso
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-400/15 flex items-center justify-center shrink-0">
            <Trophy size={24} className="text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Como funciona o Concurso</h1>
            <p className="text-base text-muted-foreground mt-1">
              A competição mensal de previsões da Zafe, com prêmios reais em dinheiro.
            </p>
          </div>
        </div>
      </div>

      {/* O que é */}
      <section className="space-y-3 text-base text-muted-foreground leading-relaxed">
        <h2 className="text-xl font-semibold text-white">O que é o Concurso</h2>
        <p>
          O Concurso Zafe é uma <strong className="text-white">competição mensal de habilidade</strong>{" "}
          (fantasy sport, nos termos do Art. 49 da Lei 14.790/2023 — o mesmo modelo do Cartola FC). Você
          usa uma moeda virtual, o ZC$, para registrar previsões sobre eventos reais. Quem termina o mês
          no topo do ranking ganha prêmios em dinheiro, pagos via PIX.
        </p>
      </section>

      {/* Passo a passo */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Passo a passo</h2>
        <div className="space-y-4">
          {PASSOS.map((p) => (
            <div key={p.titulo} className="bg-card border border-border rounded-xl p-5 flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-yellow-400/10 flex items-center justify-center shrink-0 mt-0.5">
                <p.icon size={18} className="text-yellow-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">{p.titulo}</p>
                <p className="text-base text-muted-foreground leading-relaxed mt-1.5">{p.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Exemplo prático */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Um exemplo prático</h2>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-base text-muted-foreground leading-relaxed space-y-3">
          <p>
            Você se inscreve e começa com <strong className="text-white">ZC$ 1.000</strong>. Coloca{" "}
            <strong className="text-white">ZC$ 100</strong> na previsão{" "}
            <em>&ldquo;O Flamengo vence o clássico&rdquo;</em>.
          </p>
          <p>
            O Flamengo vence, e a sua parte do pool paga <strong className="text-white">ZC$ 300</strong>.
            Seu saldo agora é <strong className="text-white">ZC$ 1.200</strong> — os 900 que você não
            usou, mais os 300 do palpite certo — e você sobe para o topo do ranking.
          </p>
          <p>
            Se o Flamengo não vencesse, você perderia só os ZC$ 100 do palpite e seguiria com ZC$ 900
            para tentar recuperar nas próximas previsões.
          </p>
        </div>
      </section>

      {/* Quem ganha */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Crown size={20} className="text-yellow-400" />
          Quem ganha e quanto
        </h2>
        <p className="text-base text-muted-foreground leading-relaxed">
          A premiação total da edição (ex.: <strong className="text-yellow-400">R$ 20.000</strong>) é
          dividida entre os melhores colocados do ranking final:
        </p>

        {/* Tabela de premiação */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/50">
            <p className="text-base font-semibold text-white">Premiação</p>
            <p className="text-sm text-muted-foreground">
              Percentuais sobre a premiação total (exemplo com R$ 20.000)
            </p>
          </div>
          <div className="divide-y divide-border/30 text-base">
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-white">1º lugar</span>
              <span className="text-yellow-400 font-semibold">30% — R$ 6.000</span>
            </div>
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-white">2º lugar</span>
              <span className="text-yellow-400 font-semibold">5% — R$ 1.000</span>
            </div>
            <div className="px-5 py-3.5 flex items-center justify-between gap-4">
              <span className="text-white">
                Resto do top 1% <span className="text-muted-foreground text-sm">(do 3º em diante)</span>
              </span>
              <span className="text-yellow-400 font-semibold text-right shrink-0">
                45% — R$ 9.000 divididos igualmente
              </span>
            </div>
            <div className="px-5 py-3.5 flex items-center justify-between gap-4">
              <span className="text-white">Resto do top 2%</span>
              <span className="text-yellow-400 font-semibold text-right shrink-0">
                20% — R$ 4.000 divididos igualmente
              </span>
            </div>
          </div>
          <div className="px-5 py-3.5 bg-muted/20 border-t border-border/40">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Exemplo com 10.000 inscritos: o top 1% são as 100 primeiras posições. O 1º leva R$ 6.000,
              o 2º leva R$ 1.000, do 3º ao 100º dividem R$ 9.000 (cerca de R$ 92 cada) e do 101º ao
              200º dividem R$ 4.000 (R$ 40 cada).
            </p>
          </div>
        </div>

      </section>

      {/* Empates */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Scale size={20} className="text-primary" />
          E se der empate?
        </h2>
        <div className="text-base text-muted-foreground leading-relaxed space-y-3">
          <p>
            Quem termina com o mesmo saldo de ZC$ divide o prêmio de forma justa — ninguém é
            desempatado &ldquo;no sorteio&rdquo;.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Empate no 1º e 2º lugares: os empatados somam os dois prêmios e dividem igualmente.
            </li>
            <li>
              Empate dentro de uma faixa que já divide o prêmio (top 1% ou top 2%): nada muda, todos da
              faixa já recebem partes iguais.
            </li>
            <li>
              Empate cruzando o limite de uma faixa: a faixa se estende até o último empatado. Exemplo
              com 10.000 inscritos: se cinco jogadores empatam do 99º ao 103º lugar, todos do 3º ao
              103º dividem juntos os R$ 9.000 da faixa do top 1%, e a faixa seguinte passa a começar no
              104º.
            </li>
          </ul>
        </div>
      </section>

      {/* Pagamento */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Banknote size={20} className="text-yellow-400" />
          Como o prêmio é pago
        </h2>
        <ul className="list-disc pl-5 text-base text-muted-foreground leading-relaxed space-y-2">
          <li>Os vencedores recebem um email ao fim do concurso com a posição e o valor conquistado.</li>
          <li>
            O pagamento é feito via <strong className="text-white">PIX</strong>, em até 7 dias úteis,
            somente para conta bancária do titular cadastrado na Zafe.
          </li>
          <li>Sobre os prêmios incide imposto de renda na fonte, conforme a legislação.</li>
          <li>O ZC$ nunca vira dinheiro — apenas os prêmios em R$ das primeiras colocações são pagos.</li>
        </ul>
      </section>

      {/* Requisitos */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <ShieldCheck size={20} className="text-primary" />
          Requisitos e jogo limpo
        </h2>
        <ul className="list-disc pl-5 text-base text-muted-foreground leading-relaxed space-y-2">
          <li>Idade mínima de 18 anos e verificação de identidade (CPF).</li>
          <li>Uma inscrição por pessoa por edição. Contas múltiplas são desclassificadas.</li>
          <li>
            O Concurso é uma competição de habilidade — o resultado depende do seu conhecimento e
            análise, não de sorte. Veja também os{" "}
            <Link href="/termos" className="text-primary hover:underline">
              Termos de Uso
            </Link>{" "}
            e a página de{" "}
            <Link href="/jogo-responsavel" className="text-primary hover:underline">
              Jogo Responsável
            </Link>
            .
          </li>
        </ul>
      </section>

      {/* CTA */}
      <div className="pt-2">
        <Link
          href="/concurso/entrar"
          className="block w-full text-center rounded-xl bg-yellow-400 text-black font-bold py-4 text-base hover:bg-yellow-300 transition-colors"
        >
          Participar do concurso
        </Link>
      </div>

      <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed">
        Se o concurso tiver menos de 500 inscritos, a edição será cancelada e todos os participantes
        serão reembolsados.
      </p>
    </div>
  );
}
