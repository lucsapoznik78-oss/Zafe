// Feature flags de produto.
//
// CONCURSO_ENABLED: o Concurso (mundo pago, R$ via PIX) aparece no site.
// Ligado por padrão — kill switch: NEXT_PUBLIC_CONCURSO_ENABLED=false.
export const CONCURSO_ENABLED =
  process.env.NEXT_PUBLIC_CONCURSO_ENABLED !== "false";

// O Concurso está sendo DIVULGADO, mas ainda não começou. A primeira edição
// válida é a de setembro/2026 — não existe concurso valendo antes disso, e
// nenhuma inscrição, palpite ou prêmio conta até lá. Enquanto isto for true,
// toda a copy do Concurso fala no futuro.
export const CONCURSO_EM_BREVE = false;
export const CONCURSO_ESTREIA = "setembro de 2026";
export const CONCURSO_ESTREIA_CURTO = "Setembro";

// Concurso realmente aberto: inscrição valendo e prêmio em R$ em jogo. É isto
// (e não a mera visibilidade) que justifica o muro de CPF/18+ e o hub /inicio
// como home — divulgar o Concurso não pode reativar essas travas.
export const CONCURSO_ABERTO = CONCURSO_ENABLED && !CONCURSO_EM_BREVE;

// Modo Escalação (fantasy de escalação em Z$, zona grátis). Opt-IN, ao
// contrário do Concurso: enquanto ninguém definir NEXT_PUBLIC_ESCALACAO_ENABLED,
// o modo não existe para o usuário. É o que permite o schema e o painel de
// apuração viverem em produção sem nenhuma superfície pública.
export const ESCALACAO_ENABLED =
  process.env.NEXT_PUBLIC_ESCALACAO_ENABLED === "true";

// Home padrão pós-login: o hub /inicio — Concurso no topo, zona grátis embaixo.
// Vale também na fase de anúncio: é justamente ali que o usuário logado descobre
// que o Concurso estreia em setembro.
export const HOME_PATH = "/inicio";
