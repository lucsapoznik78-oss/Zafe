import type { Ruleset } from "../rules";
import { boxeV1 } from "./boxe.v1";
import { f1V1 } from "./f1.v1";
import { surfV1 } from "./surf.v1";
import { ufcV1 } from "./ufc.v1";

// Registro dos rulesets transcritos dos manuais. NÃO é a fonte da verdade em
// produção — quem manda é `escalacao_regra` no banco, que é versionado e
// imutável depois de publicado (Art. 24 § único). Este registro existe para o
// seed (scripts/seed-escalacao-regras.mjs) e para os testes.
//
// Faltam Champions League e tênis. Quando chegarem, entram aqui e viram um
// INSERT — nenhuma linha de `scoring.ts` muda.
export const RULESETS: Record<string, Ruleset> = {
  "ufc.v1": ufcV1,
  "surf.v1": surfV1,
  "f1.v1": f1V1,
  "boxe.v1": boxeV1,
};

export { boxeV1, f1V1, surfV1, ufcV1 };
