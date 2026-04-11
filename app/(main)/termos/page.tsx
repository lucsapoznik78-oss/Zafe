export default function TermosPage() {
  return (
    <div className="py-8 max-w-2xl mx-auto space-y-8 text-sm text-muted-foreground">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Termos de Uso e Política de Privacidade</h1>
        <p className="text-xs">Última atualização: março de 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">1. Sobre a Zafe</h2>
        <p>
          A Zafe é uma plataforma de mercados de previsão onde usuários podem investir em eventos reais do Brasil e do mundo.
          Ao criar uma conta, você concorda com estes termos e com nossa política de privacidade.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">2. Elegibilidade</h2>
        <p>
          Para usar a Zafe você deve ter pelo menos 18 anos de idade e capacidade legal para celebrar contratos.
          Ao criar uma conta, você declara que atende a esses requisitos.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">3. Como funciona</h2>
        <p>
          Usuários depositam saldo na plataforma e usam esse saldo para investir em resultados de eventos (SIM ou NÃO).
          Uma comissão de 6% é descontada no momento do depósito. Quando o mercado é resolvido, vencedores recebem
          seus ganhos proporcionalmente ao valor investido e às odds vigentes no momento.
        </p>
        <p>
          Investimentos não-matcheados (sem contrapartida) são reembolsados integralmente quando o mercado é encerrado.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">4. Odds e retornos</h2>
        <p>
          As odds exibidas na plataforma (no formato X:Y) representam o retorno potencial com base na probabilidade
          implícita atual do mercado. As odds variam conforme novos investimentos são realizados e não são garantidas
          no momento da resolução — o retorno final depende do pool total do mercado.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">5. Saques e depósitos</h2>
        <p>
          Depósitos são realizados via PIX e creditados após confirmação de pagamento.
          Saques são processados em até 2 dias úteis para a chave PIX cadastrada no perfil.
          A Zafe se reserva o direito de solicitar verificação de identidade antes de processar saques.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">6. Conduta do usuário</h2>
        <p>
          É proibido usar a plataforma para lavagem de dinheiro, fraude ou qualquer atividade ilegal.
          A Zafe pode suspender ou encerrar contas que violem estes termos sem aviso prévio.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">7. Privacidade e dados</h2>
        <p>
          Coletamos apenas os dados necessários para o funcionamento da plataforma: email, nome, e histórico de
          transações. Seus dados não são vendidos a terceiros. Utilizamos Supabase como provedor de banco de dados
          e autenticação, com dados armazenados em servidores seguros.
        </p>
        <p>
          Você pode solicitar a exclusão da sua conta e de todos os seus dados a qualquer momento entrando em
          contato pelo suporte.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">8. Limitação de responsabilidade</h2>
        <p>
          A Zafe não garante resultados de investimentos. Todo investimento envolve risco de perda total do valor
          investido. A plataforma não é responsável por perdas decorrentes de decisões de investimento dos usuários.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">9. Alterações nos termos</h2>
        <p>
          A Zafe pode atualizar estes termos a qualquer momento. Usuários serão notificados por email sobre
          mudanças significativas. O uso continuado da plataforma após notificação constitui aceitação dos novos termos.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">10. Contato</h2>
        <p>
          Para dúvidas, suporte ou solicitações relacionadas à privacidade, entre em contato pelo email da plataforma.
        </p>
      </section>
    </div>
  );
}
