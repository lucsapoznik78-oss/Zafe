-- Migração 085: restaura o bônus de boas-vindas de 1.000 Z$.
--
-- O QUE QUEBROU
-- A 013 e a 016 puseram o bônus dentro de `handle_new_user`. Depois disso, as
-- migrações 051, 052, 053 e 056 reescreveram essa função INTEIRA para mexer em
-- outra coisa (endereço/AML, jogo responsável, CPF, username+termos) e cada uma
-- delas recriou o corpo a partir do template antigo da 001 — que insere a
-- carteira com `balance = 0`. Quatro vezes seguidas o bônus foi apagado sem que
-- ninguém tocasse nele de propósito. Toda conta criada depois disso nasceu com
-- 0,00 Z$.
--
-- POR QUE ISSO É GRAVE
-- "1.000 Z$ de presente" está no Hero, no CTA, no HowItWorks, nos cards de
-- entrada e — o que importa de verdade — nos Termos de Uso. Oferta veiculada
-- vincula o fornecedor (CDC art. 30). A conta nascer zerada não é um bug de
-- saldo, é a plataforma descumprindo o que prometeu por escrito.
--
-- A CORREÇÃO
-- O bônus sai de `handle_new_user` e passa a viver num trigger próprio sobre
-- `wallets`. Essa é a parte que importa: `handle_new_user` é uma função que o
-- histórico mostra ser reescrita inteira toda vez que o cadastro muda, e é
-- exatamente por isso que o bônus se perdeu quatro vezes. Num trigger separado,
-- sobre outra tabela, uma futura reescrita do cadastro não tem como derrubá-lo.
-- `handle_new_user` fica intocada aqui de propósito.

BEGIN;

CREATE OR REPLACE FUNCTION public.grant_welcome_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Carteira que já nasce com saldo veio de outro caminho (seed, restauração,
  -- migração de dados). Não é conta nova e não leva bônus.
  IF NEW.balance <> 0 THEN
    RETURN NEW;
  END IF;

  -- Idempotência ancorada na TRANSAÇÃO, não no saldo. Quem recebeu os 1.000 e
  -- gastou tudo também está em 0,00 — e não pode receber de novo. O extrato é a
  -- única fonte da verdade sobre "esta conta já foi creditada".
  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE user_id = NEW.user_id
      AND type = 'bonus'
      AND description ILIKE '%boas-vindas%'
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE wallets SET balance = balance + 1000 WHERE user_id = NEW.user_id;

  INSERT INTO transactions (user_id, type, amount, net_amount, description)
  VALUES (NEW.user_id, 'bonus', 1000, 1000, 'Bônus de boas-vindas — bem-vindo à Zafe!');

  RETURN NEW;
END;
$$;

-- AFTER INSERT: o UPDATE lá dentro dispara `trg_bump_wallet_version`, que é
-- BEFORE UPDATE — não há reentrância no próprio trigger de INSERT.
DROP TRIGGER IF EXISTS trg_welcome_bonus ON public.wallets;
CREATE TRIGGER trg_welcome_bonus
  AFTER INSERT ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.grant_welcome_bonus();

-- Reparação das contas atingidas.
--
-- O filtro `balance = 0` não é redundante com o filtro da transação. Existem 12
-- contas de março–maio/2026 que também não têm a transação de boas-vindas (são
-- anteriores à convenção de descrição da 016) mas já têm saldo — 1.000, 1.010,
-- 1.376, 6.661 Z$. Elas foram creditadas por outro caminho, e somar +1.000
-- nelas seria emitir Z$ em duplicidade. Só entram aqui as contas que ficaram
-- de fato com a carteira vazia.
WITH sem_bonus AS (
  SELECT w.user_id
  FROM wallets w
  WHERE w.balance = 0
    AND NOT EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.user_id = w.user_id
        AND t.type = 'bonus'
        AND t.description ILIKE '%boas-vindas%'
    )
),
creditadas AS (
  UPDATE wallets w
  SET balance = w.balance + 1000
  FROM sem_bonus s
  WHERE w.user_id = s.user_id
  RETURNING w.user_id
)
INSERT INTO transactions (user_id, type, amount, net_amount, description)
SELECT user_id, 'bonus', 1000, 1000, 'Bônus de boas-vindas — bem-vindo à Zafe!'
FROM creditadas;

COMMIT;
