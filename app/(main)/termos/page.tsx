import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_DOCS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Termos de Uso | Zafe",
  description:
    "Termos de Uso da Zafe: elegibilidade, moeda virtual Z$, funcionamento dos palpites, Concurso com prêmio em dinheiro real, conduta e alterações.",
};

export default function TermosPage() {
  return (
    <div
      data-legal-doc="termos"
      className="py-8 max-w-2xl mx-auto space-y-8 text-sm text-muted-foreground"
    >
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Termos de Uso</h1>
        <p className="text-xs">Versão {LEGAL_DOCS.termos.version} · vigente desde 29 de julho de 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">1. Sobre a Zafe</h2>
        <p>
          A Zafe é uma liga de previsões onde usuários competem palpitando sobre o resultado de eventos do Brasil e do mundo.
          Ao criar uma conta, você concorda com estes termos e com nossa política de privacidade.
        </p>
        <p>
          A Zafe não é uma casa de apostas, exchange ou intermediadora financeira. É uma plataforma de software
          com modelo de assinatura (Zafe Premium) e concursos de habilidade preditiva.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">2. Elegibilidade</h2>
        <p>
          Para usar a Zafe você deve ter pelo menos 18 anos de idade e capacidade legal para celebrar contratos.
          Ao criar uma conta, você declara que atende a esses requisitos.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">3. Moeda virtual (Z$)</h2>
        <p>
          A Zafe utiliza Z$ como moeda virtual exclusiva da plataforma. O Z$ não tem valor monetário real,
          não é conversível em dinheiro e não pode ser sacado. Você não deposita dinheiro real para obter Z$.
        </p>
        <p>
          Z$ é distribuído via bônus de boas-vindas (1.000 Z$), bônus semanal de engajamento e como prêmio
          nos eventos da zona grátis (Liga, Comunidade, Games e Privadas). Palpites não-correspondidos
          (sem contrapartida) são reembolsados integralmente em Z$ quando o evento é encerrado.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">4. Como funcionam os palpites</h2>
        <p>
          Usuários alocam Z$ em palpites SIM ou NÃO sobre eventos. Quando o evento é resolvido, os vencedores
          recebem o Z$ do lado perdedor proporcional ao valor alocado, sem comissão da plataforma (100% do pool é distribuído).
          As probabilidades variam conforme novos palpites são registrados.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">5. Concurso e prêmios em dinheiro real</h2>
        <p>
          A Zafe promove o Concurso, um fantasy game de habilidade sobre eventos reais de esporte e
          e-sports, enquadrado como fantasy sport pelo Art. 49 da Lei 14.790/2023. O prêmio é fixo,
          definido na abertura e independente do número de inscritos ou do valor arrecadado.
        </p>
        <p>
          A inscrição em cada edição do Concurso custa <strong className="text-foreground">R$ 20,00</strong>,
          salvo edições expressamente anunciadas como promocionais ou gratuitas. O valor é devido por
          edição e por participante, dá direito ao saldo inicial de ZC$ da edição e não é convertido
          em Z$ nem em qualquer saldo sacável. O valor e as condições de cada edição são informados
          na abertura, antes da confirmação da inscrição.
        </p>
        <p>
          Prêmios são pagos via PIX diretamente ao vencedor. Sobre os prêmios incide imposto de renda
          retido na fonte, conforme a legislação tributária aplicável; a Zafe efetua a retenção e o
          recolhimento devidos, e o valor creditado ao vencedor é líquido. Para receber prêmios, o
          usuário deve cadastrar CPF e chave PIX válidos, de sua própria titularidade.
        </p>
        <p>
          O dinheiro real de prêmios não transita pela conta do usuário na plataforma. Não existe saldo em
          R$ dentro da Zafe. O único fluxo de dinheiro real é: Zafe → conta bancária do vencedor (via PIX).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">6. Zafe Premium</h2>
        <p>
          A assinatura Zafe Premium concede acesso a ferramentas de curadoria de informação, análise de
          calibração pessoal e outros benefícios de plataforma. A assinatura é cobrada mensalmente via PIX
          recorrente ou cartão de crédito. Não inclui crédito em Z$.
        </p>
        <p>
          A curadoria de informação é gerada por inteligência artificial a partir de fontes públicas e não
          constitui recomendação de investimento ou predição de resultado.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">7. Conduta do usuário, suspensão e defesa</h2>
        <p>
          É proibido usar a plataforma para fraude, manipulação de resultados, criação de múltiplas contas
          ou qualquer atividade ilegal.
        </p>
        <p>
          Ao suspender ou encerrar uma conta, a Zafe informará o usuário, no email cadastrado, sobre a
          medida adotada e o motivo concreto que a fundamentou. A suspensão cautelar imediata só é
          admitida quando houver indício objetivo de fraude, manipulação de resultado ou risco à
          integridade de uma edição em curso — e, mesmo nesse caso, a comunicação com o motivo será
          enviada em até 48 horas.
        </p>
        <p>
          O usuário tem direito a apresentar defesa no prazo de <strong className="text-foreground">15 dias
          corridos</strong> contados da comunicação, pelos canais de contato desta política. A Zafe
          analisará a defesa e responderá de forma fundamentada em até 15 dias corridos.
        </p>
        <p>
          Se a irregularidade não se confirmar, a conta é restabelecida e a Zafe devolve integralmente a
          taxa de inscrição de toda edição em que o usuário tenha sido impedido de competir. Se o usuário
          já tinha direito a prêmio na posição final apurada, o prêmio é pago. A desclassificação
          confirmada por fraude ou multiplicidade de contas não gera direito a devolução da taxa.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">8. Proteção de dados pessoais e cookies</h2>
        <p>
          A Zafe é a <strong className="text-foreground">controladora</strong> dos dados pessoais tratados na
          plataforma, nos termos da Lei nº 13.709/2018 (LGPD). Seus dados não são vendidos, alugados nem
          cedidos a terceiros para fins de marketing.
        </p>
        <p>
          O detalhamento — o que é tratado e com qual base legal do art. 7º, prazos de retenção,
          transferência internacional, seus direitos do art. 18, procedimento em caso de incidente,
          cookies e o contato do Encarregado — está na{" "}
          <Link href="/politica" className="text-primary hover:underline">Política de Privacidade</Link>,
          documento próprio que integra estes termos e é aceito em conjunto com eles.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">9. Limitação de responsabilidade</h2>
        <p>
          O Z$ não tem valor monetário real. A participação em concursos envolve habilidade preditiva, não
          garantia de prêmio. A Zafe não é responsável por decisões tomadas com base em curadoria de informação.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">10. Alterações nos termos</h2>
        <p>
          A Zafe pode alterar estes termos, mas nunca de forma retroativa: qualquer alteração produz
          efeitos apenas para o futuro e não altera relações já constituídas nem direitos já adquiridos
          pelo usuário.
        </p>
        <p>
          Mudanças relevantes — em especial as que afetem preço, regras de premiação, obrigações do
          usuário ou tratamento de dados pessoais — serão comunicadas por email e na plataforma com
          antecedência mínima de <strong className="text-foreground">30 dias corridos</strong> antes de
          entrarem em vigor. Correções de erro material e ajustes exigidos por lei ou por determinação
          de autoridade podem ter vigência imediata, com comunicação no mesmo ato.
        </p>
        <p>
          <strong className="text-foreground">Nenhuma alteração se aplica a edição do Concurso já em
          andamento.</strong> As regras de uma edição são as vigentes na data da sua abertura e valem
          até a apuração e o pagamento dos prêmios daquela edição, inclusive quanto a critério de
          ranking, distribuição de premiação, desempate e taxa de inscrição.
        </p>
        <p>
          Nenhuma versão nova vale por uso continuado: ao entrar em vigor, a plataforma pede seu{" "}
          <strong className="text-foreground">aceite expresso</strong>, com o resumo das mudanças, antes de
          você continuar navegando. Se você não concordar, pode encerrar sua conta sem qualquer ônus e
          terá devolvida a taxa de inscrição de edição que ainda não tenha começado.
        </p>
        <p>
          As versões anteriores destes termos, com a data em que passaram a valer e o resumo do que
          mudou, ficam disponíveis em{" "}
          <Link href="/termos/historico" className="text-primary hover:underline">/termos/historico</Link>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">11. Contato</h2>
        <p>
          Para dúvidas, suporte, defesa nos termos da seção 7 ou solicitações relacionadas à
          privacidade:{" "}
          <a href="mailto:contato@zafe.app" className="text-primary hover:underline">
            contato@zafe.app
          </a>
          .
        </p>
      </section>
    </div>
  );
}
