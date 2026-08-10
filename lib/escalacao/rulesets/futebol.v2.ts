// Futebol · versão 2 — recalibragem de escala do `futebol.v1`.
//
// A v1 transcreveu o manual fielmente, e o manual foi escrito pensando em UMA
// partida. Só que no modo fixo o time trava antes da primeira rodada e pontua em
// TODAS as partidas do mês (`agregacaoMes: "soma"`): no Brasileirão são ~4
// rodadas. Com os valores da v1, um titular médio fazia ~20 por rodada, ou seja
// ~80 no mês, e um time de 11 emitia ~880 Z$ contra uma entrada de 200 — o modo
// imprimia 4,4× a entrada para TODO mundo, não só para quem escalou bem.
// Pior: um atacante com 3 gols fazia 150 Z$ sozinho e pagava o time inteiro.
//
// A v2 mantém a estrutura e as proporções do manual (o gol continua valendo
// ~1,7 vitória) e divide a escala por 5. O alvo é o time médio terminar o mês
// perto da entrada — a graça fica na diferença entre escalar bem e mal, não em
// receber por comparecer. As frequências que sustentam a conta estão no teste
// (`__tests__/calibragem.test.ts`), não neste comentário, para poderem ser
// discutidas e ajustadas.
//
// v1 continua no banco intacta: é o registro do que vigorou, e o card que a
// fixou não pode ser reescrito (Art. 24 § único).

import type { Ruleset } from "../rules";

export const futebolV2: Ruleset = {
  esporte: "futebol",
  versao: 2,
  tetoEvento: 9999,
  pisoEvento: -9999,
  agregacaoMes: "soma",
  // Por atleta, por MÊS (≈4 rodadas) — não por partida. 11 titulares × 18 ≈ 200.
  evAlvo: 18,

  regras: [
    {
      tipo: "lookup",
      rotulo: "Resultado do time",
      stat: "resultado",
      mapa: { vitoria: 6, empate: 2, derrota: -2, nao_jogou: 0 },
    },
    { tipo: "linear", rotulo: "Gols marcados", stat: "gols", fator: 10 },
    { tipo: "linear", rotulo: "Assistências", stat: "assistencias", fator: 5 },
    { tipo: "flag", rotulo: "Jogo sem sofrer gol", stat: "sem_sofrer_gol", pontos: 4 },
    { tipo: "flag", rotulo: "Cartão vermelho", stat: "cartao_vermelho", pontos: -4 },
    { tipo: "linear", rotulo: "Gol contra", stat: "gols_contra", fator: -4 },
  ],

  stats: [
    {
      key: "resultado",
      tipo: "cat",
      rotulo: "Resultado do time",
      opcoes: ["vitoria", "empate", "derrota", "nao_jogou"],
    },
    { key: "gols", tipo: "num", rotulo: "Gols marcados" },
    { key: "assistencias", tipo: "num", rotulo: "Assistências" },
    {
      key: "sem_sofrer_gol",
      tipo: "bool",
      rotulo: "Jogo sem sofrer gol",
      ajuda: "Só para goleiro ou zagueiro",
    },
    { key: "cartao_vermelho", tipo: "bool", rotulo: "Cartão vermelho" },
    { key: "gols_contra", tipo: "num", rotulo: "Gols contra" },
  ],
};
