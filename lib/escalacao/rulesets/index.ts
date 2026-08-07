import type { Ruleset } from "../rules";
import { boxeV1 } from "./boxe.v1";
import { f1V1 } from "./f1.v1";
import { futebolV1 } from "./futebol.v1";
import { nbaV1 } from "./nba.v1";
import { nflV1 } from "./nfl.v1";
import { surfV1 } from "./surf.v1";
import { tenisV1 } from "./tenis.v1";
import { ufcV1 } from "./ufc.v1";
import { valorantV1 } from "./valorant.v1";

// Registro dos rulesets transcritos dos manuais. NÃO é a fonte da verdade em
// produção — quem manda é `escalacao_regra` no banco, que é versionado e
// imutável depois de publicado (Art. 24 § único). Este registro existe para o
// seed (scripts/seed-escalacao-regras.mts) e para os testes.
//
// Os nove manuais de 7/ago/2026 pontuam DIRETO EM Z$: o que o manual chama de
// "+30 pontos" é +30 Z$ na carteira. Por isso todo card usa `pontos_por_z = 1`.
export const RULESETS: Record<string, Ruleset> = {
  "ufc.v1": ufcV1,
  "boxe.v1": boxeV1,
  "f1.v1": f1V1,
  "surf.v1": surfV1,
  "tenis.v1": tenisV1,
  "futebol.v1": futebolV1,
  "nba.v1": nbaV1,
  "nfl.v1": nflV1,
  "valorant.v1": valorantV1,
};

export { boxeV1, f1V1, futebolV1, nbaV1, nflV1, surfV1, tenisV1, ufcV1, valorantV1 };
