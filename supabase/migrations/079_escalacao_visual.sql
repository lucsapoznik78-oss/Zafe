-- Escalação: as três colunas que a tela de escalação precisa para parecer uma
-- escalação, e não uma lista de nomes.
--
-- A tela nova dispõe os 12 slots num campo, como o Cartola. Um card de atleta ali
-- é foto + nome + de onde ele vem + o que ele faz. Nada disso existia: a tabela
-- guardava só `nome`, `genero` e `categoria`.
--
-- As três são NULLABLE de propósito. A carga de fotos é trabalho de curadoria
-- (direito de imagem, upload pro Storage) e vai chegar depois — e vai chegar
-- incompleta, porque atleta obscuro não tem foto decente em lugar nenhum. A UI
-- degrada sozinha: sem `foto_url` desenha as iniciais no mesmo círculo, sem
-- `clube`/`posicao` some a linha. Preencher é melhoria progressiva, nunca
-- pré-requisito para o card abrir.
--
-- `posicao` é TEXT livre e não enum: o rótulo é a nomenclatura do esporte, não
-- uma taxonomia da plataforma. "ATA" no futebol, "PG" na NBA, "QB" na NFL,
-- "Peso-leve" no UFC, "Piloto" na F1, "Duelist" no Valorant. Enumerar isso seria
-- uma migration por esporte novo — exatamente o que o desenho do módulo evita.

ALTER TABLE escalacao_atleta
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS clube    TEXT,
  ADD COLUMN IF NOT EXISTS posicao  TEXT;

-- Só URL absoluta http(s). Caminho relativo entraria no `src` da imagem e
-- resolveria contra o domínio da Zafe, servindo 404 silencioso em vez de foto.
ALTER TABLE escalacao_atleta
  ADD CONSTRAINT escalacao_atleta_foto_url_absoluta
  CHECK (foto_url IS NULL OR foto_url ~ '^https?://');
