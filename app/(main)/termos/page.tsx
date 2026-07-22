export default function TermosPage() {
  return (
    <div className="py-8 max-w-2xl mx-auto space-y-8 text-sm text-muted-foreground">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Termos de Uso e Política de Privacidade</h1>
        <p className="text-xs">Última atualização: julho de 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">1. Sobre a Zafe</h2>
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
        <h2 className="text-base font-semibold text-white">2. Elegibilidade</h2>
        <p>
          Para usar a Zafe você deve ter pelo menos 18 anos de idade e capacidade legal para celebrar contratos.
          Ao criar uma conta, você declara que atende a esses requisitos.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">3. Moeda virtual (Z$)</h2>
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
        <h2 className="text-base font-semibold text-white">4. Como funcionam os palpites</h2>
        <p>
          Usuários alocam Z$ em palpites SIM ou NÃO sobre eventos. Quando o evento é resolvido, os vencedores
          recebem o Z$ do lado perdedor proporcional ao valor alocado, sem comissão da plataforma (100% do pool é distribuído).
          As probabilidades variam conforme novos palpites são registrados.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">5. Concurso e prêmios em dinheiro real</h2>
        <p>
          A Zafe promove o Concurso, um fantasy game de habilidade sobre eventos reais de esporte e
          e-sports, enquadrado como fantasy sport pelo Art. 49 da Lei 14.790/2023. O prêmio é fixo,
          definido na abertura e independente do número de inscritos ou do valor arrecadado.
        </p>
        <p>
          Prêmios são pagos via PIX diretamente ao vencedor. Prêmios de concursos estão sujeitos
          a imposto de renda retido na fonte (IRRF) de 30% sobre o valor total, conforme Lei 11.196/2005, Art. 70.
          Para receber prêmios, o usuário deve cadastrar CPF e chave PIX válidos.
        </p>
        <p>
          O dinheiro real de prêmios não transita pela conta do usuário na plataforma. Não existe saldo em
          R$ dentro da Zafe. O único fluxo de dinheiro real é: Zafe → conta bancária do vencedor (via PIX).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">6. Zafe Premium</h2>
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
        <h2 className="text-base font-semibold text-white">7. Conduta do usuário</h2>
        <p>
          É proibido usar a plataforma para fraude, manipulação de resultados, criação de múltiplas contas
          ou qualquer atividade ilegal. A Zafe pode suspender ou encerrar contas que violem estes termos
          sem aviso prévio.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">8. Privacidade e dados</h2>
        <p>
          Coletamos apenas os dados necessários para o funcionamento da plataforma: email, nome e histórico
          de atividade. Dados bancários (CPF e chave PIX) são coletados apenas para pagamento de prêmios.
          Seus dados não são vendidos a terceiros. A Zafe segue os requisitos da LGPD (Lei 13.709/2018).
        </p>
        <p>
          Você pode solicitar a exclusão da sua conta e de todos os seus dados a qualquer momento entrando em
          contato pelo suporte.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">9. Cookies</h2>
        <p>
          A Zafe utiliza apenas cookies essenciais, estritamente necessários para o funcionamento
          da plataforma: (a) cookies de sessão de autenticação, que mantêm você conectado à sua conta;
          e (b) o cookie <code className="text-white/80">zafe_ref</code>, gravado quando você acessa um
          link de convite de outro usuário, usado exclusivamente para atribuir a indicação (expira em 7 dias).
        </p>
        <p>
          Não utilizamos cookies de publicidade, análise ou rastreamento de terceiros. Por serem
          estritamente necessários, esses cookies dispensam consentimento nos termos da LGPD
          (Lei 13.709/2018). Você pode removê-los limpando os dados do seu navegador — isso encerrará
          sua sessão na Zafe.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">10. Limitação de responsabilidade</h2>
        <p>
          O Z$ não tem valor monetário real. A participação em concursos envolve habilidade preditiva, não
          garantia de prêmio. A Zafe não é responsável por decisões tomadas com base em curadoria de informação.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">11. Alterações nos termos</h2>
        <p>
          A Zafe pode atualizar estes termos a qualquer momento. Usuários serão notificados sobre mudanças
          significativas. O uso continuado da plataforma após notificação constitui aceitação dos novos termos.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">12. Contato</h2>
        <p>
          Para dúvidas, suporte ou solicitações relacionadas à privacidade, entre em contato pelo email da plataforma.
        </p>
      </section>
    </div>
  );
}
