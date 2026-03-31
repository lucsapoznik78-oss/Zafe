/**
 * Funções utilitárias para apostas privadas
 */

// Votos necessários para 67% dado N juízes ativos
export function votosNecessarios(totalJuizes: number): number {
  return Math.ceil(totalJuizes * 0.67);
}

// Avança para fase de eleição de líder se houver participantes suficientes
export async function checkRecrutamento(supabase: any, topicId: string) {
  const { data: participants } = await supabase
    .from("topic_participants")
    .select("id")
    .eq("topic_id", topicId)
    .eq("status", "accepted");

  const count = participants?.length ?? 0;
  if (count < 5) return;

  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("topics").update({
    private_phase: "leader_election",
    leader_election_deadline: deadline,
  }).eq("id", topicId);

  // Notificar todos os participantes
  const { data: members } = await supabase
    .from("topic_participants")
    .select("user_id")
    .eq("topic_id", topicId)
    .eq("status", "accepted");

  const notifications = (members ?? []).map((m: any) => ({
    user_id: m.user_id,
    type: "market_resolved",
    title: "Vote no seu líder!",
    body: "A aposta privada já tem participantes suficientes. Vote em quem vai representar seu lado.",
    data: { topic_id: topicId, phase: "leader_election" },
  }));
  if (notifications.length > 0) {
    await supabase.from("notifications").insert(notifications);
  }
}

// Elege o líder de um lado baseado na votação
export async function elegerLider(supabase: any, topicId: string, side: "A" | "B") {
  // Conta votos por candidato
  const { data: votes } = await supabase
    .from("leader_votes")
    .select("candidate_id")
    .eq("topic_id", topicId)
    .eq("side", side);

  if (!votes || votes.length === 0) {
    // Sem votos: escolhe por senioridade (conta mais antiga)
    const { data: members } = await supabase
      .from("topic_participants")
      .select("user_id, profiles:profiles(created_at)")
      .eq("topic_id", topicId)
      .eq("side", side)
      .eq("status", "accepted")
      .order("joined_at", { ascending: true });

    const oldest = members?.[0]?.user_id;
    if (oldest) {
      await supabase.from("topic_sides").update({
        leader_id: oldest,
        leader_elected_at: new Date().toISOString(),
      }).eq("topic_id", topicId).eq("side", side);
    }
    return oldest;
  }

  // Contagem de votos
  const contagem: Record<string, number> = {};
  for (const v of votes) {
    contagem[v.candidate_id] = (contagem[v.candidate_id] ?? 0) + 1;
  }

  // Vencedor (maior número de votos)
  let winner = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0];

  // Empate: escolhe conta mais antiga
  const maxVotos = Math.max(...Object.values(contagem));
  const empatados = Object.entries(contagem)
    .filter(([, v]) => v === maxVotos)
    .map(([id]) => id);

  if (empatados.length > 1) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, created_at")
      .in("id", empatados)
      .order("created_at", { ascending: true });
    winner = profiles?.[0]?.id ?? winner;
  }

  await supabase.from("topic_sides").update({
    leader_id: winner,
    leader_elected_at: new Date().toISOString(),
  }).eq("topic_id", topicId).eq("side", side);

  return winner;
}

// Verifica se ambos os lados têm líder → avança para negociação de juízes
export async function checkLideresEleitos(supabase: any, topicId: string) {
  const { data: sides } = await supabase
    .from("topic_sides")
    .select("side, leader_id")
    .eq("topic_id", topicId);

  const sideA = sides?.find((s: any) => s.side === "A");
  const sideB = sides?.find((s: any) => s.side === "B");

  if (!sideA?.leader_id || !sideB?.leader_id) return;

  const deadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  await supabase.from("topics").update({
    private_phase: "judge_negotiation",
    negotiation_deadline: deadline,
  }).eq("id", topicId);

  // Notificar ambos os líderes
  await supabase.from("notifications").insert([
    {
      user_id: sideA.leader_id,
      type: "market_resolved",
      title: "Você é o líder! Proponha os juízes",
      body: "Você foi eleito líder. Proponha 3 juízes para a aposta.",
      data: { topic_id: topicId, phase: "judge_negotiation", role: "leader" },
    },
    {
      user_id: sideB.leader_id,
      type: "market_resolved",
      title: "Aguardando proposta de juízes",
      body: "Os líderes foram eleitos. Aguarde a proposta de juízes do lado adversário.",
      data: { topic_id: topicId, phase: "judge_negotiation", role: "leader" },
    },
  ]);
}

// Verifica se há ao menos 1 juiz ativo (aceito por ambos os líderes) → avança para fase ativa
export async function checkJuizesConfirmados(supabase: any, topicId: string) {
  const { data: active } = await supabase
    .from("judge_nominations")
    .select("id")
    .eq("topic_id", topicId)
    .eq("status", "active");

  if ((active?.length ?? 0) < 1) return;

  await supabase.from("topics").update({
    private_phase: "active",
    status: "active",
  }).eq("id", topicId);

  // Notificar todos os participantes
  const { data: members } = await supabase
    .from("topic_participants")
    .select("user_id")
    .eq("topic_id", topicId)
    .eq("status", "accepted");

  const notifs = (members ?? []).map((m: any) => ({
    user_id: m.user_id,
    type: "market_resolved",
    title: "Aposta ativa!",
    body: "Todos os juízes foram confirmados. A aposta está ativa.",
    data: { topic_id: topicId, phase: "active" },
  }));
  if (notifs.length > 0) {
    await supabase.from("notifications").insert(notifs);
  }
}

// Abre votação dos juízes (chamado quando closes_at passa)
export async function abrirVotacao(supabase: any, topicId: string, round: number) {
  const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

  const phase = round === 1 ? "voting" : "voting_round2";
  await supabase.from("topics").update({
    private_phase: phase,
    judge_vote_deadline: deadline,
  }).eq("id", topicId);

  // Criar registros de voto vazios para cada juiz ativo
  const { data: judges } = await supabase
    .from("judge_nominations")
    .select("judge_user_id")
    .eq("topic_id", topicId)
    .eq("status", "active");

  const voteRows = (judges ?? []).map((j: any) => ({
    topic_id: topicId,
    judge_id: j.judge_user_id,
    round,
    deadline,
  }));
  if (voteRows.length > 0) {
    await supabase.from("judge_outcome_votes").insert(voteRows);
  }

  // Notificar juízes
  const notifs = (judges ?? []).map((j: any) => ({
    user_id: j.judge_user_id,
    type: "market_resolved",
    title: round === 1 ? "Vote no resultado!" : "Segunda votação aberta",
    body: "Você tem 1 hora para votar no resultado da aposta. Acesse agora.",
    data: { topic_id: topicId, phase, round },
  }));
  if (notifs.length > 0) {
    await supabase.from("notifications").insert(notifs);
  }
}

// Fecha a votação e processa resultado
export async function fecharVotacao(supabase: any, topicId: string, round: number) {
  // Anular votos não enviados dentro do prazo
  await supabase
    .from("judge_outcome_votes")
    .update({ vote: null })
    .eq("topic_id", topicId)
    .eq("round", round)
    .is("voted_at", null);

  // Contar votos válidos
  const { data: votes } = await supabase
    .from("judge_outcome_votes")
    .select("vote")
    .eq("topic_id", topicId)
    .eq("round", round)
    .not("vote", "is", null);

  const validos = votes ?? [];
  const simCount = validos.filter((v: any) => v.vote === "sim").length;
  const naoCount = validos.filter((v: any) => v.vote === "nao").length;
  const total = validos.length;

  if (total === 0) {
    // Nenhum voto válido → reembolso
    await reembolsarPrivado(supabase, topicId, "Nenhum juiz votou");
    return;
  }

  const needed = votosNecessarios(total);

  if (simCount >= needed) {
    const { pagarVencedores } = await import("./payout");
    await pagarVencedores(supabase, topicId, "sim");
    await supabase.from("topics").update({ private_phase: "resolved" }).eq("id", topicId);
    return;
  }

  if (naoCount >= needed) {
    const { pagarVencedores } = await import("./payout");
    await pagarVencedores(supabase, topicId, "nao");
    await supabase.from("topics").update({ private_phase: "resolved" }).eq("id", topicId);
    return;
  }

  // Não atingiu 67%
  if (round === 1) {
    // Abre segunda rodada
    await abrirVotacao(supabase, topicId, 2);
  } else {
    // Segunda rodada também falhou → reembolso
    await reembolsarPrivado(supabase, topicId, "Juízes não chegaram a consenso após 2 votações");
  }
}

async function reembolsarPrivado(supabase: any, topicId: string, motivo: string) {
  const { reembolsarTodos } = await import("./payout");
  await reembolsarTodos(supabase, topicId, motivo);
  await supabase.from("topics").update({ private_phase: "cancelled" }).eq("id", topicId);
}
