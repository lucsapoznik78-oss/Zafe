const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://mhckuhqyyfoapzgrqeco.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oY2t1aHF5eWZvYXB6Z3JxZWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTI1NywiZXhwIjoyMDkwMjExMjU3fQ.w-Bum-ydpJGFLsTaBkGrm52mxmNeDQIk8Ib7fnJs-0s"
);

// Probabilidades baseadas em dados reais de mercados de predição (Polymarket, Metaculus, odds esportivas)
// e notícias de março 2026
const UPDATES = [
  {
    id: "6bb41bdc-a07b-4d09-8602-746cd550de8a",
    finalProb: 0.40,
    trend: "up",
    description: "O ministro Alexandre de Moraes, do STF, emitirá algum mandado de prisão contra um político de destaque nacional (deputado federal, senador, governador ou ex-presidente) com cumprimento até o dia 1° de agosto de 2026. Consideram-se políticos de destaque aqueles com mandato ativo ou ex-presidentes. Base: investigações do 8/1 e do suposto golpe de 2022 estão em curso.",
  },
  {
    id: "109e2fca-e72a-49bd-b745-0480514dd1a5",
    finalProb: 0.04,
    trend: "flat",
    description: "Considera-se invasão qualquer operação militar ofensiva chinesa em território taiwanês confirmada por fontes oficiais internacionais. Prazo: 30 de junho de 2026. Mercados de predição (Polymarket) apontam ~4% de probabilidade.",
  },
  {
    id: "749b3d7f-85cc-47cd-b60d-159294ab57c4",
    finalProb: 0.04,
    trend: "down",
    description: "Qualquer condenação formal (guilty verdict) em tribunal dos EUA nos processos criminais pendentes contra Donald Trump, confirmada até 30 de junho de 2026. Como presidente em exercício, a política do DOJ impede novas acusações federais, e processos estaduais enfrentam obstáculos extraordinários.",
  },
  {
    id: "fe118aa7-9daa-46d5-ac05-a9b109612631",
    finalProb: 0.11,
    trend: "up",
    description: "A Seleção Brasileira conquistará o título da Copa do Mundo FIFA 2026, realizada nos EUA, Canadá e México. Resolução após a final do torneio. Odds nas principais casas de apostas (BetMGM, DraftKings) colocam o Brasil em +800, equivalendo a ~11% de probabilidade.",
  },
  {
    id: "175dd801-f9ca-45c6-a5ec-363697cd79b9",
    finalProb: 0.45,
    trend: "flat",
    description: "Neymar Jr. estará na lista de convocados da Seleção Brasileira para a Copa do Mundo 2026 e disputará pelo menos um jogo no torneio. O mercado Polymarket dedicado a essa questão aponta 45% de probabilidade, refletindo a incerteza em torno da recuperação de sua lesão no joelho.",
  },
  {
    id: "e745b793-7ac9-46ce-9284-4fc7d1f44376",
    finalProb: 0.97,
    trend: "up",
    description: "Marcos Roberto de Almeida, o 'Vorcaro', será morto ou preso por forças de segurança brasileiras até 31 de maio de 2026. ATENÇÃO: Daniel Vorcaro foi preso em 4 de março de 2026 na Operação Compliance Zero e transferido para presídio federal de segurança máxima em Brasília em 6 de março de 2026. O STF votou para manter a prisão preventiva em 20/03/2026.",
  },
  {
    id: "5aa1ba7e-6c11-4cfa-87c2-ccf97b9f61d2",
    finalProb: 0.60,
    trend: "up",
    description: "O regime norte-coreano realizará um teste de míssil balístico intercontinental (ICBM) confirmado por agências internacionais de defesa até o dia 1° de julho de 2026. A Coreia do Norte já realizou testes de mísseis balísticos em março de 2026 e disparos de cruzeiro em abril. Mercados de predição apontam ~60% de probabilidade.",
  },
  {
    id: "54e9f208-b082-4b8f-9d1e-60cb9a502f00",
    finalProb: 0.15,
    trend: "down",
    description: "O governo federal brasileiro anunciará oficialmente a criação ou recriação de um tributo de abrangência nacional até 30 de abril de 2026. A reforma tributária (PL 68/2024) já foi promulgada (LC 227/2026 publicada em jan/2026) e o governo foca em implementação. Um imposto adicional novo nos próximos dias é improvável.",
  },
  {
    id: "880c8fb8-a8db-4597-a28b-02cb60ca7f9c",
    finalProb: 0.93,
    trend: "up",
    description: "O presidente Luiz Inácio Lula da Silva concluirá seu mandato presidencial em curso sem sofrer prisão, afastamento compulsório ou renúncia forçada até 31 de dezembro de 2026. A Constituição Federal confere ampla proteção a presidentes em exercício e não há mecanismo judicial ativo que permita sua prisão.",
  },
  {
    id: "e479fa07-b048-4b52-8383-457adbf9b4b0",
    finalProb: 0.12,
    trend: "down",
    description: "O preço do Bitcoin (BTC) atingirá ou ultrapassará R$ 600.000,00 até 30 de junho de 2026. Em março/2026 o BTC está em torno de R$ 350.000–370.000 (≈USD 67–70k × R$ 5,24/USD). Para chegar a R$ 600k seria necessário quase dobrar em ~3 meses, o que não é o cenário base da maioria dos analistas.",
  },
  {
    id: "5127d8bc-ba03-42eb-97e8-86df953556d3",
    finalProb: 0.04,
    trend: "down",
    description: "A cotação do dólar americano (USD) frente ao real brasileiro atingirá ou ultrapassará R$ 7,00 no câmbio comercial em qualquer dia útil até 31 de maio de 2026. Em março/2026 o dólar está em ~R$ 5,24, e as projeções de analistas para 2026 ficam entre R$ 4,54 e R$ 5,19. Uma alta de 33% em 5 semanas seria um choque sem precedentes.",
  },
  {
    id: "685920b9-54d3-454c-9470-0b7705e39c4a",
    finalProb: 0.22,
    trend: "up",
    description: "O Clube de Regatas do Flamengo conquistará o título da Copa Libertadores da América em 2026. O Flamengo é o atual campeão (2025) e aparece como favorito nas casas de apostas (odds ~4.15 na Betfair, implicando ~24% de probabilidade). Palmeiras e Cruzeiro são os principais concorrentes.",
  },
  {
    id: "5596cabc-ee0a-4e93-b92d-568add3bae18",
    finalProb: 0.98,
    trend: "up",
    description: "Elon Musk deixará formalmente seu cargo ou função oficial no governo Trump (DOGE ou qualquer outra posição) de forma voluntária ou forçada até 31 de agosto de 2026. ATENÇÃO: Musk oficialmente saiu do DOGE em 30 de maio de 2025, após o prazo máximo de 130 dias como Funcionário Público Especial. Em março de 2026, já se passaram ~10 meses desde sua saída.",
  },
  {
    id: "5b4645bf-7dd1-4a6b-b2d1-a7cd55c6928c",
    finalProb: 0.11,
    trend: "flat",
    description: "A Argentina, tricampeã mundial (1978, 1986 e 2022), tentará conquistar o tetracampeonato na Copa do Mundo FIFA 2026 realizada na América do Norte. Odds nas principais casas de apostas (BetMGM) estão em +800, equivalendo a ~11% de probabilidade, com Espanha e Inglaterra sendo favoritas à frente da Argentina.",
  },
  {
    id: "d08c76d0-89e8-4361-bdad-76b6195bb366",
    finalProb: 0.10,
    trend: "down",
    description: "O Supremo Tribunal Federal julgará e invalidará (total ou parcialmente) legislação sobre regulação de redes sociais e combate à desinformação até 30 de junho de 2026. O PL 2630 (Marco das Fake News) foi arquivado em 2024 após pressão das big techs. O STF já derrubou o art. 19 do Marco Civil em junho/2025. Uma nova lei aprovada E derrubada neste prazo é improvável.",
  },
  {
    id: "72e08866-24b1-444d-8aed-4e90b648a4b4",
    finalProb: 0.12,
    trend: "down",
    description: "O IBGE confirmará dois trimestres consecutivos de queda do PIB brasileiro (recessão técnica) com dados referentes ao 1° semestre de 2026. O consenso de analistas projeta crescimento de 1,6% a 2,0% para 2026. A Selic em 15% gera pressão, mas recessão no 1° semestre não é o cenário base.",
  },
  {
    id: "24fde667-0bdb-4a72-93ac-62d469f3b06e",
    finalProb: 0.85,
    trend: "up",
    description: "A OpenAI anunciará oficialmente que o ChatGPT ultrapassou 1 bilhão de usuários ativos mensais até 31 de dezembro de 2026. Em fevereiro/2026 a OpenAI reportou 900 milhões de usuários semanais ativos — o que implica usuários mensais já acima de 1 bilhão. Diversas análises independentes estimam 1,2–1,5 bilhão de MAU já em 2026.",
  },
  {
    id: "1a735d27-dddf-4528-aeee-fadbe928b4e1",
    finalProb: 0.95,
    trend: "flat",
    description: "A Rede Globo confirmará um participante de alto perfil (ator, cantor, influencer com mais de 5M de seguidores) como parte do elenco principal do BBB 27. Desde o BBB 21, o formato 'Camarote' com celebridades é padrão em todas as edições. O BBB 26 (em exibição) tem 5 celebridades no elenco, incluindo Solange Couto e Henri Castelli.",
  },
  {
    id: "648923e5-4670-4f21-acc8-433c650eaae7",
    finalProb: 0.20,
    trend: "flat",
    description: "A Sociedade Esportiva Palmeiras será campeã do Campeonato Brasileiro Série A de 2026. Palmeiras e Flamengo são co-favoritos. Odds na Betfair apontam ~22-31% para o Palmeiras. Abel Ferreira está contratado até 2027.",
  },
  {
    id: "8badd8fb-0bcf-47a3-9afc-0314fc63760a",
    finalProb: 0.20,
    trend: "down",
    description: "A Petrobras anunciará e pagará ao menos um dividendo extraordinário (fora do calendário regular) ao longo do ano de 2026. O Plano Estratégico 2026-2030 da Petrobras não menciona dividendos extraordinários, ao contrário do plano anterior. Em nov/2025, a empresa afirmou que extras são 'muito provavelmente' fora dos planos no curto prazo.",
  },
];

// Gerar snapshots realistas com tendência a chegar no finalProb
function generateSnapshots(topicId, finalProb, trend, days = 45) {
  const snapshots = [];
  const now = new Date();

  // Ponto de partida: prob oposta à tendência final (para dar narrativa)
  let startProb;
  if (trend === "up") {
    startProb = Math.max(0.05, finalProb - 0.15 - Math.random() * 0.10);
  } else if (trend === "down") {
    startProb = Math.min(0.95, finalProb + 0.15 + Math.random() * 0.10);
  } else {
    startProb = finalProb + (Math.random() - 0.5) * 0.1;
  }
  startProb = Math.max(0.03, Math.min(0.97, startProb));

  let prob = startProb;
  const totalDrift = finalProb - startProb;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const progress = (days - i) / days;

    // Movimento com direção + ruído menor nos últimos dias (convergência)
    const driftPerDay = totalDrift / days;
    const noiseScale = 0.025 * (1 - progress * 0.5); // diminui ruído no fim
    const noise = (Math.random() - 0.5) * noiseScale * 2;
    prob = Math.max(0.03, Math.min(0.97, prob + driftPerDay + noise));

    // Forçar convergência no último dia
    if (i === 0) prob = finalProb;

    snapshots.push({
      topic_id: topicId,
      prob_sim: parseFloat(prob.toFixed(4)),
      volume_sim: parseFloat((Math.random() * 800 + 100).toFixed(2)),
      volume_nao: parseFloat((Math.random() * 800 + 100).toFixed(2)),
      recorded_at: new Date(date.getTime() - Math.random() * 3600000).toISOString(),
    });
  }
  return snapshots;
}

async function main() {
  console.log("🔄 Atualizando tópicos com probabilidades reais...\n");

  for (const t of UPDATES) {
    // 1. Atualizar descrição
    const { error: descErr } = await supabase
      .from("topics")
      .update({ description: t.description })
      .eq("id", t.id);
    if (descErr) console.error(`  ❌ Descrição ${t.id}:`, descErr.message);

    // 2. Deletar snapshots antigos
    const { error: delErr } = await supabase
      .from("topic_snapshots")
      .delete()
      .eq("topic_id", t.id);
    if (delErr) console.error(`  ❌ Delete snapshots ${t.id}:`, delErr.message);

    // 3. Inserir novos snapshots com probabilidades corretas
    const snapshots = generateSnapshots(t.id, t.finalProb, t.trend, 45);
    const { error: snapErr } = await supabase
      .from("topic_snapshots")
      .insert(snapshots);

    if (snapErr) {
      console.error(`  ❌ Snapshots ${t.id}:`, snapErr.message);
    } else {
      console.log(`✅ ${t.id.slice(0,8)}... → prob: ${(t.finalProb * 100).toFixed(0)}% | ${snapshots.length} snapshots`);
    }
  }

  console.log("\n✅ Atualização concluída!");
}

main().catch(console.error);
