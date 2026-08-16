-- 087 — Tipos de transação do personagem (loja de figura)
--
-- Migration SOZINHA de propósito. Um valor criado por `ALTER TYPE ... ADD VALUE`
-- não pode ser USADO na mesma transação em que foi criado (é a mesma armadilha
-- anotada na 075). Como a 089 escreve `'figura_compra'` dentro de uma RPC, os
-- valores precisam já estar comitados antes — daí o arquivo separado.
--
--   figura_desbloqueio → Z$ 100, cobrado uma vez, libera o editor de personagem
--   figura_compra      → compra de um acessório da loja (preço por raridade)
--
-- Não existe tipo de estorno: item comprado é permanente e não há revenda.
-- Apagar o personagem (DELETE /api/perfil/figura) não devolve Z$ nem tira o
-- inventário — quem pagou, pagou.

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'figura_desbloqueio';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'figura_compra';
