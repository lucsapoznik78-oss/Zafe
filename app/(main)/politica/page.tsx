import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_DOCS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Privacidade | Zafe",
  description:
    "Como a Zafe trata dados pessoais: bases legais, prazos de retenção, transferência internacional, direitos do titular e contato do Encarregado.",
};

export default function PoliticaPage() {
  return (
    <div
      data-legal-doc="politica"
      className="py-8 max-w-2xl mx-auto space-y-8 text-sm text-muted-foreground"
    >
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Política de Privacidade</h1>
        <p className="text-xs">Versão {LEGAL_DOCS.politica.version} · vigente desde 29 de julho de 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">1. Quem trata seus dados</h2>
        <p>
          A Zafe é a <strong className="text-white">controladora</strong> dos dados pessoais tratados na
          plataforma, nos termos da Lei nº 13.709/2018 (LGPD). Seus dados não são vendidos, alugados nem
          cedidos a terceiros para fins de marketing.
        </p>
        <p>
          Esta política integra os{" "}
          <Link href="/termos" className="text-primary hover:underline">Termos de Uso</Link> e usa os
          mesmos conceitos definidos lá.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">2. O que tratamos e com qual base legal</h2>
        <p>
          Cada tratamento tem uma base legal específica do art. 7º da LGPD:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-white">Cadastro e operação da conta</strong> (email, nome, nome de
            usuário, senha em formato irreversível, histórico de palpites, saldo de Z$/ZC$ e ranking) —
            execução de contrato, art. 7º, V.
          </li>
          <li>
            <strong className="text-white">CPF, data de nascimento e verificação de identidade</strong> —
            cumprimento de obrigação legal e regulatória, art. 7º, II, combinado com a exigência de
            identificação e de restrição a maiores de 18 anos aplicável ao Concurso.
          </li>
          <li>
            <strong className="text-white">Chave PIX e dados de pagamento de prêmio</strong> — execução de
            contrato, art. 7º, V, e cumprimento de obrigação legal tributária, art. 7º, II.
          </li>
          <li>
            <strong className="text-white">Registros de acesso e endereço IP</strong> — cumprimento de
            obrigação legal, art. 7º, II, conforme o art. 15 da Lei nº 12.965/2014 (Marco Civil da
            Internet).
          </li>
          <li>
            <strong className="text-white">Registro do aceite dos documentos legais</strong> (documento,
            versão, hash do texto, data, endereço IP e navegador) — cumprimento de obrigação legal,
            art. 7º, II, e exercício regular de direito em processo, art. 7º, VI. É o que permite
            demonstrar qual texto você aceitou e quando.
          </li>
          <li>
            <strong className="text-white">Prevenção a fraude, contas múltiplas e manipulação de
            resultado</strong> — legítimo interesse, art. 7º, IX, e art. 11, II, &ldquo;g&rdquo;,
            limitado ao estritamente necessário para preservar a integridade das edições e os direitos
            dos demais participantes.
          </li>
          <li>
            <strong className="text-white">Notificações push e comunicações de produto não
            essenciais</strong> — consentimento, art. 7º, I, revogável a qualquer momento nas
            configurações da conta ou do navegador, sem prejuízo do uso da plataforma.
          </li>
          <li>
            <strong className="text-white">Emails transacionais</strong> (confirmação de conta,
            redefinição de senha, aviso de premiação) — execução de contrato, art. 7º, V. Não dependem de
            consentimento e não podem ser desativados enquanto a conta existir.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">3. Por quanto tempo guardamos</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-white">Registros de acesso:</strong> 6 meses, prazo do art. 15 da Lei
            nº 12.965/2014. Findo o prazo, são eliminados, salvo ordem judicial de guarda por prazo maior.
          </li>
          <li>
            <strong className="text-white">Dados de cadastro e histórico de participação:</strong>{" "}
            enquanto a conta existir. Após o pedido de exclusão, são eliminados em até 30 dias, exceto o
            que a lei obrigue a reter.
          </li>
          <li>
            <strong className="text-white">CPF, comprovação de idade e registros de pagamento de
            prêmio:</strong> 5 anos contados do fim do exercício em que o prêmio foi pago, por exigência
            fiscal (art. 173 do Código Tributário Nacional) e para defesa em eventual reclamação de
            consumo (art. 27 do CDC).
          </li>
          <li>
            <strong className="text-white">Registro do aceite dos documentos legais:</strong> 5 anos
            contados do encerramento da conta, prazo do art. 27 do CDC — é o período em que a Zafe pode
            precisar demonstrar em juízo o que foi contratado.
          </li>
          <li>
            <strong className="text-white">Registros de desclassificação por fraude:</strong> 5 anos, com
            base no legítimo interesse de impedir reincidência.
          </li>
        </ul>
        <p>
          Encerrado o prazo e cessada a finalidade, os dados são eliminados ou anonimizados de forma
          irreversível.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">4. Transferência internacional</h2>
        <p>
          <strong className="text-white">Seus dados são armazenados e processados fora do Brasil.</strong>{" "}
          A Zafe utiliza operadores que mantêm a infraestrutura nos Estados Unidos:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-white">Supabase</strong> — banco de dados, autenticação e
            armazenamento, em região dos Estados Unidos (US West, Oregon).
          </li>
          <li>
            <strong className="text-white">Vercel</strong> — hospedagem da aplicação e registros de
            acesso, nos Estados Unidos.
          </li>
          <li>
            <strong className="text-white">Resend</strong> — envio de emails transacionais, nos Estados
            Unidos.
          </li>
        </ul>
        <p>
          A transferência ocorre com fundamento no art. 33, II, &ldquo;d&rdquo;, e no art. 33, V, da LGPD:
          cláusulas contratuais padrão firmadas com cada operador, que impõem obrigações de proteção
          compatíveis com a lei brasileira, e necessidade para a execução do contrato entre você e a Zafe.
          Cópia das cláusulas aplicáveis pode ser solicitada ao Encarregado.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">5. Seus direitos</h2>
        <p>
          Você pode, a qualquer momento e gratuitamente, exercer os direitos do art. 18 da LGPD:
          confirmação da existência de tratamento; acesso aos dados; correção de dados incompletos,
          inexatos ou desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários ou
          tratados em desconformidade; portabilidade; informação sobre com quem compartilhamos seus
          dados; informação sobre a possibilidade de não consentir e as consequências disso; e revogação
          do consentimento. A resposta é enviada em até 15 dias.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">6. Incidentes de segurança</h2>
        <p>
          Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, a
          Zafe comunicará a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados em
          prazo razoável, nos termos do art. 48 da LGPD. A comunicação indicará a natureza dos dados
          atingidos, os titulares envolvidos, as medidas técnicas de proteção empregadas, os riscos
          envolvidos, o motivo de eventual demora e as medidas adotadas para reverter ou mitigar os
          efeitos. Incidentes são registrados internamente com data, escopo e providências, ainda que
          não atinjam o limiar de comunicação.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">7. Cookies</h2>
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
        <h2 className="text-base font-semibold text-white">8. Encarregado (DPO)</h2>
        <p>
          Encarregado pelo tratamento de dados pessoais, nos termos do art. 41 da LGPD:{" "}
          <strong className="text-white">Luc Sapoznik</strong>. Contato para exercício
          de direitos, dúvidas e reclamações:{" "}
          <a href="mailto:contato@zafe.app.br" className="text-primary hover:underline">
            contato@zafe.app.br
          </a>
          . Você também pode peticionar diretamente à ANPD.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">9. Alterações desta política</h2>
        <p>
          Alterações produzem efeitos apenas para o futuro. Mudanças relevantes são comunicadas com
          antecedência mínima de <strong className="text-white">30 dias corridos</strong> e exigem novo
          aceite para continuar usando a plataforma. As versões anteriores ficam disponíveis em{" "}
          <Link href="/politica/historico" className="text-primary hover:underline">
            /politica/historico
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
