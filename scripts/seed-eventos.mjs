import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mhckuhqyyfoapzgrqeco.supabase.co";
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oY2t1aHF5eWZvYXB6Z3JxZWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNTI1NywiZXhwIjoyMDkwMjExMjU3fQ.w-Bum-ydpJGFLsTaBkGrm52mxmNeDQIk8Ib7fnJs-0s";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

// ── 1. Criar tabela topic_templates via Management API ───────────
async function criarTabela() {
  const sql = `
    CREATE TABLE IF NOT EXISTS topic_templates (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title        TEXT NOT NULL,
      description  TEXT NOT NULL,
      category     topic_category NOT NULL,
      is_large     BOOLEAN NOT NULL DEFAULT FALSE,
      duration_days INT NOT NULL DEFAULT 7,
      used_at      TIMESTAMPTZ,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE topic_templates ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='topic_templates' AND policyname='Admin ve templates') THEN
        CREATE POLICY "Admin ve templates" ON topic_templates FOR ALL
          USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
      END IF;
    END $$;
  `;

  const res = await fetch(`https://api.supabase.com/v1/projects/mhckuhqyyfoapzgrqeco/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await res.json();
  if (!res.ok) {
    console.warn("⚠️  Management API falhou (precisa de PAT):", body?.message ?? JSON.stringify(body));
    console.log("   Tentando verificar se a tabela já existe...");
    const { error } = await supabase.from("topic_templates").select("id").limit(1);
    if (error?.code === "42P01") {
      console.error("❌ Tabela topic_templates não existe. Cole o migration 009 no SQL Editor do Supabase.");
      console.error("   https://supabase.com/dashboard/project/mhckuhqyyfoapzgrqeco/sql/new");
      return false;
    }
  } else {
    console.log("✅ Tabela topic_templates criada/verificada.");
  }
  return true;
}

// ── 2. Buscar admin_id ───────────────────────────────────────────
async function getAdminId() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true)
    .limit(1)
    .single();
  if (error || !data) throw new Error("Nenhum admin encontrado: " + error?.message);
  return data.id;
}

// ── 3. Eventos iniciais ──────────────────────────────────────────
function eventos(adminId) {
  return [
    // GRANDES (min_bet = 20)
    { creator_id: adminId, title: "O Palmeiras vai vencer o clássico contra o Corinthians no dia 5 de abril?", description: "Com o Paulistão em fase decisiva, o Verdão enfrenta o Timão em confronto direto pelo título. Quem leva?", category: "esportes", status: "active", min_bet: 20, closes_at: "2026-04-05T22:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "O dólar vai fechar acima de R$ 6,00 na semana de 31/03 a 04/04?", description: "Com tensão fiscal e cenário externo volátil, o câmbio permanece pressionado. O dólar rompe o piso de R$ 6?", category: "economia", status: "active", min_bet: 20, closes_at: "2026-04-04T21:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "A Selic vai ser cortada na reunião do Copom de maio de 2026?", description: "O Copom voltou a subir os juros. Há chance de corte antecipado dado o cenário de inflação?", category: "economia", status: "active", min_bet: 20, closes_at: "2026-04-05T15:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "O Brasil vai vencer a próxima rodada das Eliminatórias da Copa do Mundo?", description: "Seleção busca vaga direta no Mundial. A equipe do Dorival consegue os 3 pontos fora de casa?", category: "esportes", status: "active", min_bet: 20, closes_at: "2026-04-11T22:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "O STF vai pautar e julgar algum processo relacionado a Bolsonaro em abril?", description: "O tribunal tem vários processos em espera. Haverá avanço concreto em ao menos um deles este mês?", category: "politica", status: "active", min_bet: 20, closes_at: "2026-04-12T18:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "O IBOVESPA vai superar 140.000 pontos até 12 de abril?", description: "Com a bolsa oscilando na faixa de 130k, os touros tentam romper a resistência histórica de 140k.", category: "economia", status: "active", min_bet: 20, closes_at: "2026-04-12T18:30:00+00:00", is_private: false },
    { creator_id: adminId, title: "O governo Lula vai anunciar algum corte de gastos até 19 de abril?", description: "Sob pressão do mercado e do Congresso, o Executivo promete ajuste. Vem algo concreto?", category: "politica", status: "active", min_bet: 20, closes_at: "2026-04-19T18:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "O Flamengo vai liderar o Brasileirão após as primeiras 5 rodadas?", description: "Rubro-negro reforçado quer disparar na frente. Consegue abrir vantagem logo no início?", category: "esportes", status: "active", min_bet: 20, closes_at: "2026-04-18T22:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "A inflação do IPCA de março vai ficar abaixo de 0,5%?", description: "Pressão de alimentos e energia pressionam o índice. O IBGE confirma arrefecimento?", category: "economia", status: "active", min_bet: 20, closes_at: "2026-04-09T12:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "O Bitcoin vai superar US$ 90.000 até o final de abril de 2026?", description: "Após correção, a principal cripto tenta retomar os máximos. Bull run confirmado?", category: "economia", status: "active", min_bet: 20, closes_at: "2026-04-26T23:59:00+00:00", is_private: false },
    { creator_id: adminId, title: "O Lula vai fazer reforma ministerial até o fim de abril?", description: "Rumores de troca de ministros circulam desde fevereiro. Uma mudança concreta acontece em abril?", category: "politica", status: "active", min_bet: 20, closes_at: "2026-04-26T18:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "Algum time brasileiro vai se classificar para as oitavas da Libertadores 2026?", description: "Fase de grupos começa quente. Ao menos um clube brasileiro já garante classificação antes da última rodada?", category: "esportes", status: "active", min_bet: 20, closes_at: "2026-04-25T22:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "A Apple vai anunciar novidades de IA no WWDC 2026 que impactem o mercado brasileiro?", description: "A conferência de desenvolvedores da Apple promete. Algum recurso de IA chegará ao Brasil no anúncio?", category: "tecnologia", status: "active", min_bet: 20, closes_at: "2026-04-30T23:59:00+00:00", is_private: false },
    { creator_id: adminId, title: "O Santos vai confirmar o acesso à Série A até o fim de abril?", description: "A Vila Belmiro aguarda o retorno à elite. Os números apontam para o acesso em abril?", category: "esportes", status: "active", min_bet: 20, closes_at: "2026-04-30T23:59:00+00:00", is_private: false },
    { creator_id: adminId, title: "A Netflix vai ter alguma produção brasileira no top 10 global em abril de 2026?", description: "Conteúdo nacional vem performando bem globalmente. Algum título do Brasil domina o ranking?", category: "entretenimento", status: "active", min_bet: 20, closes_at: "2026-04-30T23:59:00+00:00", is_private: false },
    // PEQUENOS (min_bet = 1)
    { creator_id: adminId, title: "O São Paulo vai vencer o próximo jogo do Paulistão?", description: "O Tricolor busca se manter vivo na competição. Vitória confirma bom momento da equipe.", category: "esportes", status: "active", min_bet: 1, closes_at: "2026-04-04T22:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "O dólar vai subir acima de R$ 6,20 esta semana?", description: "O câmbio está volátil. Haverá algum driver externo ou interno que empurre o dólar para cima de 6,20?", category: "economia", status: "active", min_bet: 1, closes_at: "2026-04-04T18:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "Haverá pelo menos uma declaração polêmica de político brasileiro viral esta semana?", description: "Redes sociais brasileiras nunca dormem. Algum político vai dar manchete por motivo negativo até domingo?", category: "politica", status: "active", min_bet: 1, closes_at: "2026-04-05T23:59:00+00:00", is_private: false },
    { creator_id: adminId, title: "O Vasco vai trocar de técnico antes do fim de semana de 5/04?", description: "O Cruz-Maltino tem histórico de demissões relâmpago. Mais uma mudança vem aí?", category: "esportes", status: "active", min_bet: 1, closes_at: "2026-04-05T12:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "Algum artista brasileiro vai entrar no top 10 do Spotify global esta semana?", description: "O funk e o sertanejo brasileiro têm conquistado o mundo. Quem chega ao topo?", category: "entretenimento", status: "active", min_bet: 1, closes_at: "2026-04-06T23:59:00+00:00", is_private: false },
    { creator_id: adminId, title: "O Fluminense vai se classificar na próxima fase da Copa do Brasil?", description: "O Flu enfrenta adversário fora de casa. A viagem termina com classificação?", category: "esportes", status: "active", min_bet: 1, closes_at: "2026-04-09T22:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "O preço da gasolina vai subir em pelo menos 3 capitais até 13/04?", description: "Petrobras e distribuidoras ajustam preços com frequência. Novo reajuste em abril?", category: "economia", status: "active", min_bet: 1, closes_at: "2026-04-11T18:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "Vai ter greve ou paralisação de alguma categoria na semana de 07/04?", description: "Trabalhadores de diversos setores estão em negociação. Alguma categoria cruza os braços?", category: "outros", status: "active", min_bet: 1, closes_at: "2026-04-11T23:59:00+00:00", is_private: false },
    { creator_id: adminId, title: "Elon Musk vai fazer algum anúncio polêmico sobre o X ou Tesla esta semana?", description: "O bilionário raramente fica em silêncio por mais de 7 dias. O que vem por aí?", category: "tecnologia", status: "active", min_bet: 1, closes_at: "2026-04-12T23:59:00+00:00", is_private: false },
    { creator_id: adminId, title: "Algum influencer brasileiro com mais de 5M de seguidores vai viralizar negativamente?", description: "O ecossistema de influencers é imprevisível. Mais um vai para as tendências do Twitter?", category: "entretenimento", status: "active", min_bet: 1, closes_at: "2026-04-13T23:59:00+00:00", is_private: false },
    { creator_id: adminId, title: "O Athletico-PR vai vencer o próximo jogo na Copa Sul-Americana?", description: "O Furacão precisa de resultado para avançar. Dá pra Curitiba?", category: "esportes", status: "active", min_bet: 1, closes_at: "2026-04-17T22:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "O preço do petróleo vai cair abaixo de US$ 70 até 18/04?", description: "Tensões geopolíticas vs desaceleração da demanda global. O barril despenca?", category: "economia", status: "active", min_bet: 1, closes_at: "2026-04-18T18:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "O governo vai anunciar algum benefício social novo até 20/04?", description: "Com eleições de 2026 no horizonte, o governo distribui medidas populares. Vem algo novo?", category: "politica", status: "active", min_bet: 1, closes_at: "2026-04-20T18:00:00+00:00", is_private: false },
    { creator_id: adminId, title: "Algum reality show brasileiro vai gerar meme viral até 20/04?", description: "BBB, A Fazenda ou outro programa... o Brasil ama um meme de reality. Qual vai bombar?", category: "entretenimento", status: "active", min_bet: 1, closes_at: "2026-04-19T23:59:00+00:00", is_private: false },
    { creator_id: adminId, title: "O Grêmio vai entrar no G4 do Brasileirão após a rodada de 24/04?", description: "O Tricolor Gaúcho quer brigar pelo título desde o início. Entra no grupo de líderes?", category: "esportes", status: "active", min_bet: 1, closes_at: "2026-04-25T23:00:00+00:00", is_private: false },
  ];
}

// ── 4. Templates ─────────────────────────────────────────────────
const templates = [
  { title: "O Palmeiras vai ganhar o título do Brasileirão?", description: "O Alviverde busca mais um título nacional. As odds indicam favorito, mas o campeonato é longo.", category: "esportes", is_large: true, duration_days: 30 },
  { title: "O Banco Central vai cortar a Selic em mais de 0,25% na próxima reunião?", description: "Com inflação oscilando, o mercado aposta no ritmo do corte. Vem mais de 25 bps?", category: "economia", is_large: true, duration_days: 21 },
  { title: "O governo vai aprovar a reforma tributária integral no Congresso até o fim do mês?", description: "A PEC tramita há meses. Consegue aprovação em dois turnos dentro do prazo?", category: "politica", is_large: true, duration_days: 28 },
  { title: "O Bitcoin vai superar US$ 100.000 este mês?", description: "A cripto mais famosa do mundo tenta romper a barreira psicológica de 100k. Acontece?", category: "economia", is_large: true, duration_days: 30 },
  { title: "O Brasil vai liderar o ranking da FIFA até o fim deste mês?", description: "A Seleção oscila na tabela. Resultados favoráveis colocam o verde e amarelo no topo?", category: "esportes", is_large: true, duration_days: 25 },
  { title: "O IPCA vai superar a meta do Banco Central este trimestre?", description: "Meta de inflação em xeque. O índice oficial estoura o teto do intervalo?", category: "economia", is_large: true, duration_days: 30 },
  { title: "O STF vai suspender alguma lei aprovada pelo Congresso este mês?", description: "Embate entre poderes é frequente. O Supremo derruba alguma legislação recente?", category: "politica", is_large: true, duration_days: 28 },
  { title: "A Embraer vai anunciar novo contrato milionário este mês?", description: "A fabricante brasileira tem negociações em andamento com várias companhias aéreas.", category: "tecnologia", is_large: true, duration_days: 30 },
  { title: "O Flamengo vai vencer a Libertadores este ano?", description: "Com elenco reforçado, o Mengão é um dos favoritos. Mas a Copa é imprevisível.", category: "esportes", is_large: true, duration_days: 21 },
  { title: "O real vai fechar abaixo de R$ 5,80 até o fim do mês?", description: "Com fluxo externo positivo, o real pode surpreender e romper suporte para baixo.", category: "economia", is_large: true, duration_days: 25 },
  { title: "O governo vai anunciar privatização de alguma estatal este mês?", description: "Agenda de privatizações segue em discussão. Algum ativo vai a leilão antes do prazo?", category: "politica", is_large: true, duration_days: 28 },
  { title: "O Corinthians vai vencer o Derby paulista este mês?", description: "O clássico mais disputado do Brasil. O Timão consegue superar o rival no momento atual?", category: "esportes", is_large: true, duration_days: 21 },
  { title: "A Petrobras vai anunciar aumento de dividendos acima do esperado?", description: "A estatal tem distribuído dividendos recordes. O mercado aguarda novo anúncio extraordinário.", category: "economia", is_large: true, duration_days: 25 },
  { title: "A SpaceX vai realizar um lançamento bem-sucedido este mês?", description: "Starship e Falcon 9 têm cronogramas apertados. Ao menos um lançamento com sucesso?", category: "tecnologia", is_large: true, duration_days: 20 },
  { title: "O Congresso vai aprovar alguma pauta econômica de impacto antes do recesso?", description: "Com agenda lotada, o Legislativo precisa de produtividade. Algo passa antes da pausa?", category: "politica", is_large: true, duration_days: 28 },
  { title: "O São Paulo vai chegar às semifinais da Copa do Brasil?", description: "O Tricolor Paulista quer voltar às glórias nacionais. Semifinal é o objetivo mínimo.", category: "esportes", is_large: true, duration_days: 30 },
  { title: "O ouro vai superar US$ 3.000 por onça este mês?", description: "Com instabilidade global, o metal precioso é refúgio. Rompe a máxima histórica?", category: "economia", is_large: true, duration_days: 25 },
  { title: "A OpenAI vai lançar novo modelo GPT mais capaz que o atual este mês?", description: "A empresa acelera lançamentos. Um novo modelo maior ou mais eficiente chega ao mercado?", category: "tecnologia", is_large: true, duration_days: 28 },
  { title: "O governo vai criar novo programa de transferência de renda este trimestre?", description: "Eleições de 2026 se aproximam. O Executivo lança benefício social inédito?", category: "politica", is_large: true, duration_days: 30 },
  { title: "O Athletico-PR vai ganhar a Copa Sul-Americana este ano?", description: "O Furacão tem tradição em copas internacionais. Consegue mais um título continental?", category: "esportes", is_large: true, duration_days: 30 },
  // Pequenos
  { title: "O Botafogo vai vencer o próximo jogo pelo Brasileirão?", description: "O Glorioso tenta manter sequência positiva. Vitória mantém a equipe no G4?", category: "esportes", is_large: false, duration_days: 7 },
  { title: "O dólar vai fechar acima de R$ 6,10 esta semana?", description: "Câmbio sensível a declarações de ministros e dados americanos. Sobe ou desce?", category: "economia", is_large: false, duration_days: 7 },
  { title: "Algum ministro do governo vai pedir demissão esta semana?", description: "Tensões internas no governo são frequentes. Uma saída surpresa acontece antes de domingo?", category: "politica", is_large: false, duration_days: 7 },
  { title: "A Meta vai anunciar novo recurso de IA para o WhatsApp esta semana?", description: "A empresa investe pesado em IA. Novidade para o app mais usado no Brasil?", category: "tecnologia", is_large: false, duration_days: 7 },
  { title: "Alguma música brasileira vai entrar no top 3 do Spotify Brasil esta semana?", description: "Funk, pagode ou sertanejo? Qual gênero domina o ranking semanal?", category: "entretenimento", is_large: false, duration_days: 7 },
  { title: "O Internacional vai vencer o Grenal desta semana?", description: "O clássico gaúcho é sempre imprevisível. O Colorado leva a melhor dessa vez?", category: "esportes", is_large: false, duration_days: 7 },
  { title: "O preço do café vai subir mais de 2% esta semana?", description: "Brasil é maior produtor mundial. Clima e dólar afetam o preço do grão.", category: "economia", is_large: false, duration_days: 7 },
  { title: "Haverá alguma manifestação política relevante no Brasil esta semana?", description: "Com polarização alta, atos e protestos são frequentes. Algo organizado acontece?", category: "politica", is_large: false, duration_days: 7 },
  { title: "O GitHub vai anunciar novo recurso no Copilot esta semana?", description: "A Microsoft investe cada vez mais em IA para desenvolvedores. Nova feature chegando?", category: "tecnologia", is_large: false, duration_days: 7 },
  { title: "Algum ator ou atriz brasileiro vai anunciar projeto internacional esta semana?", description: "Atores brasileiros têm ganhado espaço em produções globais. Novo anúncio em breve?", category: "entretenimento", is_large: false, duration_days: 7 },
  { title: "O Cruzeiro vai vencer o próximo jogo do Brasileirão?", description: "A Raposa quer brigar pelas primeiras posições. Consegue 3 pontos em casa?", category: "esportes", is_large: false, duration_days: 7 },
  { title: "A bolsa brasileira vai subir mais de 1% esta semana?", description: "Com fluxo gringo e dados positivos, o Ibovespa tenta superar resistências.", category: "economia", is_large: false, duration_days: 7 },
  { title: "O presidente vai fazer pronunciamento à nação esta semana?", description: "Uso da cadeia nacional em momentos de crise ou anúncio importante. Vem aí?", category: "politica", is_large: false, duration_days: 7 },
  { title: "A Apple vai lançar atualização do iOS com algum bug que vire meme esta semana?", description: "Atualizações às vezes chegam com problemas. Usuários brasileiros vão reclamar nas redes?", category: "tecnologia", is_large: false, duration_days: 7 },
  { title: "Algum BBB vai se tornar meme viral esta semana?", description: "O Big Brother Brasil gera conteúdo diariamente. Um momento vai explodir nas redes?", category: "entretenimento", is_large: false, duration_days: 7 },
  { title: "O Fortaleza vai se classificar na Copa do Nordeste?", description: "O Leão do Pici é favorito na competição regional. Garante vaga na próxima fase?", category: "esportes", is_large: false, duration_days: 7 },
  { title: "O IBOVESPA vai fechar em alta na próxima sexta-feira?", description: "Mercado de fechamento de semana é influenciado por dados do exterior e fluxo local.", category: "economia", is_large: false, duration_days: 5 },
  { title: "Algum prefeito de capital vai anunciar medida polêmica esta semana?", description: "Gestões municipais geram controvérsia frequente. Qual capital dá manchete negativa?", category: "politica", is_large: false, duration_days: 7 },
  { title: "A Samsung vai revelar especificações do próximo Galaxy esta semana?", description: "Lançamentos da Samsung sempre vazam antes. Alguma confirmação oficial esta semana?", category: "tecnologia", is_large: false, duration_days: 7 },
  { title: "Vai ter algum feat entre artistas do funk e do sertanejo esta semana?", description: "Fusão de gêneros é tendência. Um lançamento inesperado de collab bomba?", category: "entretenimento", is_large: false, duration_days: 7 },
];

// ── main ─────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Iniciando seed de eventos e templates...\n");

  const tabelaOk = await criarTabela();

  const adminId = await getAdminId();
  console.log(`✅ Admin encontrado: ${adminId}`);

  // Inserir 30 eventos
  const evs = eventos(adminId);
  const { error: evErr } = await supabase.from("topics").insert(evs);
  if (evErr) {
    console.error("❌ Erro ao inserir eventos:", evErr.message);
  } else {
    console.log(`✅ ${evs.length} eventos inseridos.`);
  }

  // Inserir templates (só se a tabela existir)
  if (tabelaOk) {
    const { error: tplErr } = await supabase.from("topic_templates").insert(templates);
    if (tplErr) {
      console.error("❌ Erro ao inserir templates:", tplErr.message);
    } else {
      console.log(`✅ ${templates.length} templates inseridos.`);
    }
  } else {
    console.log("⚠️  Templates não inseridos — rode primeiro o SQL da tabela.");
  }

  console.log("\n✅ Seed concluído.");
}

main().catch(console.error);
