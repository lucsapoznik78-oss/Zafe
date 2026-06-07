-- 024 — Data de nascimento no perfil (gate 18+ do Concurso).
-- Menores PODEM usar Liga/Econômico/Privadas/Comunidade; apenas o Concurso
-- (prêmio em R$ via PIX) exige maioridade. A DOB é coletada e validada na
-- inscrição do Concurso. Aditiva e idempotente (no-op em prod).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
