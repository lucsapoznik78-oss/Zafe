const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://mhckuhqyyfoapzgrqeco.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oY2t1aHF5eWZvYXB6Z3JxZWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTI1NywiZXhwIjoyMDkwMjExMjU3fQ.w-Bum-ydpJGFLsTaBkGrm52mxmNeDQIk8Ib7fnJs-0s"
);

const ADMIN_ID = "89aee166-8ccd-4511-8082-8848925d60db";

const topics = [
  // --- DADOS PELO USUÁRIO ---
  {
    title: "Alexandre de Moraes vai mandar prender algum político conhecido até 1° de agosto de 2026?",
    description: "O ministro Alexandre de Moraes, do STF, emitirá algum mandado de prisão contra um político de destaque nacional (deputado federal, senador, governador ou ex-presidente) com cumprimento até o dia 1° de agosto de 2026.",
    category: "politica",
    closes_at: "2026-08-01T23:59:00Z",
    min_bet: 1,
    startProb: 0.62,
    trend: "up",
    volume: 48200,
  },
  {
    title: "A China vai invadir Taiwan até o fim de junho de 2026?",
    description: "Considera-se invasão qualquer operação militar ofensiva chinesa em território taiwanês confirmada por fontes oficiais internacionais. Prazo: 30 de junho de 2026.",
    category: "politica",
    closes_at: "2026-06-30T23:59:00Z",
    min_bet: 1,
    startProb: 0.11,
    trend: "flat",
    volume: 132000,
  },
  {
    title: "Donald Trump vai ser condenado em algum processo judicial até junho de 2026?",
    description: "Qualquer condenação formal (guilty verdict) em tribunal dos EUA nos processos criminais pendentes contra Donald Trump, confirmada até 30 de junho de 2026.",
    category: "politica",
    closes_at: "2026-06-30T23:59:00Z",
    min_bet: 1,
    startProb: 0.19,
    trend: "down",
    volume: 215000,
  },
  {
    title: "O Brasil vai ganhar a Copa do Mundo 2026?",
    description: "A Seleção Brasileira conquistará o título da Copa do Mundo FIFA 2026, realizada nos EUA, Canadá e México. Resolução após a final do torneio.",
    category: "esportes",
    closes_at: "2026-07-20T23:59:00Z",
    min_bet: 1,
    startProb: 0.21,
    trend: "up",
    volume: 389000,
  },
  {
    title: "Neymar vai estar na Copa do Mundo 2026?",
    description: "Neymar Jr. estará na lista de convocados da Seleção Brasileira para a Copa do Mundo 2026 e disputará pelo menos um jogo no torneio.",
    category: "esportes",
    closes_at: "2026-06-01T23:59:00Z",
    min_bet: 1,
    startProb: 0.38,
    trend: "down",
    volume: 97400,
  },
  {
    title: "Vorcaro (chefe do PCC) vai ser morto ou preso até maio de 2026?",
    description: "Marcos Roberto de Almeida, o 'Vorcaro', apontado como liderança do PCC, será morto ou preso por forças de segurança brasileiras até 31 de maio de 2026.",
    category: "politica",
    closes_at: "2026-05-31T23:59:00Z",
    min_bet: 1,
    startProb: 0.27,
    trend: "flat",
    volume: 21500,
  },
  {
    title: "A Coreia do Norte vai testar um novo míssil intercontinental até 1° de julho de 2026?",
    description: "O regime norte-coreano realizará um teste de míssil balístico intercontinental (ICBM) confirmado por agências internacionais de defesa até o dia 1° de julho de 2026.",
    category: "politica",
    closes_at: "2026-07-01T23:59:00Z",
    min_bet: 1,
    startProb: 0.71,
    trend: "up",
    volume: 58700,
  },
  {
    title: "O governo Lula vai anunciar um novo imposto nacional até abril de 2026?",
    description: "O governo federal brasileiro anunciará oficialmente a criação ou recriação de um tributo de abrangência nacional até 30 de abril de 2026. Inclui contribuições, taxas e impostos.",
    category: "economia",
    closes_at: "2026-04-30T23:59:00Z",
    min_bet: 1,
    startProb: 0.73,
    trend: "up",
    volume: 44100,
  },

  // --- CRIADOS PELA ZAFE ---
  {
    title: "Lula vai terminar seu mandato sem ser preso até dezembro de 2026?",
    description: "O presidente Luiz Inácio Lula da Silva concluirá seu mandato presidencial em curso sem sofrer prisão, afastamento compulsório ou renúncia forçada até 31 de dezembro de 2026.",
    category: "politica",
    closes_at: "2026-12-31T23:59:00Z",
    min_bet: 1,
    startProb: 0.81,
    trend: "down",
    volume: 178000,
  },
  {
    title: "O Bitcoin vai superar R$ 600.000 até 30 de junho de 2026?",
    description: "O preço do Bitcoin (BTC) atingirá ou ultrapassará a marca de R$ 600.000,00 em qualquer exchange de referência (Binance, Coinbase ou Mercado Bitcoin) até 30 de junho de 2026.",
    category: "economia",
    closes_at: "2026-06-30T23:59:00Z",
    min_bet: 1,
    startProb: 0.44,
    trend: "up",
    volume: 251000,
  },
  {
    title: "O dólar vai passar de R$ 7,00 até maio de 2026?",
    description: "A cotação do dólar americano (USD) frente ao real brasileiro atingirá ou ultrapassará R$ 7,00 no câmbio comercial em qualquer dia útil até 31 de maio de 2026.",
    category: "economia",
    closes_at: "2026-05-31T23:59:00Z",
    min_bet: 1,
    startProb: 0.56,
    trend: "up",
    volume: 312000,
  },
  {
    title: "O Flamengo vai ganhar a Copa Libertadores 2026?",
    description: "O Clube de Regatas do Flamengo conquistará o título da Copa Libertadores da América em 2026. Resolução após a final do torneio.",
    category: "esportes",
    closes_at: "2026-11-30T23:59:00Z",
    min_bet: 1,
    startProb: 0.18,
    trend: "flat",
    volume: 88500,
  },
  {
    title: "O Elon Musk vai sair do governo Trump até agosto de 2026?",
    description: "Elon Musk deixará formalmente seu cargo ou função oficial no governo Trump (DOGE ou qualquer outra posição) de forma voluntária ou forçada até 31 de agosto de 2026.",
    category: "politica",
    closes_at: "2026-08-31T23:59:00Z",
    min_bet: 1,
    startProb: 0.67,
    trend: "up",
    volume: 193000,
  },
  {
    title: "A Seleção Argentina vai defender o título na Copa 2026?",
    description: "A Argentina, atual campeã mundial, conquistará o bicampeonato na Copa do Mundo FIFA 2026 realizada na América do Norte.",
    category: "esportes",
    closes_at: "2026-07-20T23:59:00Z",
    min_bet: 1,
    startProb: 0.29,
    trend: "flat",
    volume: 421000,
  },
  {
    title: "O STF vai derrubar o marco das fake news até junho de 2026?",
    description: "O Supremo Tribunal Federal julgará e derrubará (total ou parcialmente) a lei ou decreto sobre regulação de redes sociais e combate à desinformação até 30 de junho de 2026.",
    category: "politica",
    closes_at: "2026-06-30T23:59:00Z",
    min_bet: 1,
    startProb: 0.34,
    trend: "down",
    volume: 29300,
  },
  {
    title: "O Brasil vai entrar em recessão técnica no 1° semestre de 2026?",
    description: "O IBGE confirmará dois trimestres consecutivos de queda do PIB brasileiro (recessão técnica) com dados referentes ao 1° semestre de 2026.",
    category: "economia",
    closes_at: "2026-09-15T23:59:00Z",
    min_bet: 1,
    startProb: 0.31,
    trend: "up",
    volume: 67800,
  },
  {
    title: "O ChatGPT vai atingir 1 bilhão de usuários até dezembro de 2026?",
    description: "A OpenAI anunciará oficialmente que o ChatGPT ultrapassou 1 bilhão de usuários ativos mensais até 31 de dezembro de 2026.",
    category: "tecnologia",
    closes_at: "2026-12-31T23:59:00Z",
    min_bet: 1,
    startProb: 0.52,
    trend: "up",
    volume: 114000,
  },
  {
    title: "O BBB 27 vai ter um participante famoso como protagonista?",
    description: "A Rede Globo confirmará um participante de alto perfil (ator, cantor, influencer com mais de 5M de seguidores) como parte do elenco principal do BBB 27.",
    category: "entretenimento",
    closes_at: "2027-01-10T23:59:00Z",
    min_bet: 1,
    startProb: 0.78,
    trend: "flat",
    volume: 33200,
  },
  {
    title: "O Palmeiras vai ganhar o Brasileirão 2026?",
    description: "A Sociedade Esportiva Palmeiras será campeã do Campeonato Brasileiro Série A de 2026.",
    category: "esportes",
    closes_at: "2026-12-15T23:59:00Z",
    min_bet: 1,
    startProb: 0.23,
    trend: "flat",
    volume: 76400,
  },
  {
    title: "A Petrobras vai pagar dividendos extraordinários em 2026?",
    description: "A Petrobras anunciará e pagará ao menos um dividendo extraordinário (fora do calendário regular) ao longo do ano de 2026, confirmado pelo Conselho de Administração.",
    category: "economia",
    closes_at: "2026-12-31T23:59:00Z",
    min_bet: 1,
    startProb: 0.61,
    trend: "down",
    volume: 89100,
  },
];

// Gerar histórico de snapshots realistas
function generateSnapshots(topicId, startProb, trend, days = 30) {
  const snapshots = [];
  let prob = startProb;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

    // Adicionar variação aleatória com tendência
    const trendBias = trend === "up" ? 0.003 : trend === "down" ? -0.003 : 0;
    const noise = (Math.random() - 0.5) * 0.04;
    prob = Math.max(0.05, Math.min(0.95, prob + trendBias + noise));

    const totalVol = Math.random() * 2000 + 500;
    const volSim = totalVol * prob;
    const volNao = totalVol * (1 - prob);

    snapshots.push({
      topic_id: topicId,
      prob_sim: parseFloat(prob.toFixed(4)),
      volume_sim: parseFloat(volSim.toFixed(2)),
      volume_nao: parseFloat(volNao.toFixed(2)),
      recorded_at: new Date(date.getTime() - Math.random() * 3600000).toISOString(),
    });
  }
  return snapshots;
}

// Gerar apostas simuladas para dar volume
async function generateBets(topicId, volume, probSim, adminId) {
  const bets = [];
  let remaining = volume;
  const betSizes = [50, 100, 200, 500, 1000, 2000, 5000];

  while (remaining > 0) {
    const size = betSizes[Math.floor(Math.random() * betSizes.length)];
    const actual = Math.min(size, remaining);
    const side = Math.random() < probSim ? "sim" : "nao";
    bets.push({
      topic_id: topicId,
      user_id: adminId,
      side,
      amount: actual,
      status: "matched",
      matched_amount: actual,
      unmatched_amount: 0,
      potential_payout: actual * (1 / (side === "sim" ? probSim : 1 - probSim)),
      is_private: false,
    });
    remaining -= actual;
    if (bets.length > 80) break;
  }
  return bets;
}

async function main() {
  console.log("🚀 Criando tópicos...\n");

  for (const t of topics) {
    // 1. Criar tópico
    const { data: topic, error } = await supabase
      .from("topics")
      .insert({
        creator_id: ADMIN_ID,
        title: t.title,
        description: t.description,
        category: t.category,
        status: "active",
        min_bet: t.min_bet,
        closes_at: t.closes_at,
        is_private: false,
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ Erro ao criar "${t.title.slice(0, 40)}...":`, error.message);
      continue;
    }

    console.log(`✅ Criado: "${t.title.slice(0, 50)}..."`);

    // 2. Criar snapshots históricos
    const snapshots = generateSnapshots(topic.id, t.startProb, t.trend, 45);
    const { error: snapErr } = await supabase.from("topic_snapshots").insert(snapshots);
    if (snapErr) console.error("  ⚠ Snapshots:", snapErr.message);
    else console.log(`   📊 ${snapshots.length} snapshots gerados`);

    // 3. Criar apostas simuladas para volume
    const bets = await generateBets(topic.id, t.volume * 0.1, t.startProb, ADMIN_ID);
    if (bets.length > 0) {
      const { error: betErr } = await supabase.from("bets").insert(bets);
      if (betErr) console.error("  ⚠ Bets:", betErr.message);
      else console.log(`   💰 ${bets.length} investimentos simulados (vol: R$ ${t.volume.toLocaleString("pt-BR")})`);
    }

    console.log();
  }

  console.log("\n✅ Seed concluído! Total:", topics.length, "tópicos criados.");
}

main().catch(console.error);
