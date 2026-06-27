/**
 * GET /api/admin/usuarios/[id]/atividade
 *
 * Monitoramento de jogo responsável: perfil de atividade semanal de um usuário.
 *
 * Não há instrumentação de sessão/last_seen na plataforma (ver comentário em
 * app/admin/page.tsx), então o "tempo por semana" é uma ESTIMATIVA derivada do
 * ledger imutável de palpites (`bets`). Sessionizamos os palpites por gap de
 * inatividade de 30 min e somamos a duração das sessões por janela de 7 dias.
 * É um proxy de engajamento, não um cronômetro exato — rotulado como estimativa
 * na UI. Também devolve o status de jogo responsável (banido / pausa / autoexclusão).
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteParams { params: Promise<{ id: string }> }

const SEMANAS = 6;                 // janelas de 7 dias retornadas
const GAP_SESSAO_MIN = 30;         // inatividade que encerra uma sessão
const CAUDA_SESSAO_MIN = 5;        // tempo de navegação assumido por sessão (cauda)
const DIA_MS = 24 * 60 * 60 * 1000;

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const admin = createAdminClient();
  const agora = Date.now();
  const desde = new Date(agora - SEMANAS * 7 * DIA_MS).toISOString();

  const [{ data: profile }, { data: bets }] = await Promise.all([
    admin.from("profiles")
      .select("banned, self_excluded_until, cooloff_until")
      .eq("id", id)
      .single(),
    admin.from("bets")
      .select("created_at")
      .eq("user_id", id)
      .gte("created_at", desde)
      .order("created_at", { ascending: true }),
  ]);

  if (!profile) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  // Timestamps (ms) ordenados dos palpites.
  const ts = (bets ?? [])
    .map((b: { created_at: string }) => new Date(b.created_at).getTime())
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  // Sessioniza: novo "início de sessão" quando o gap desde o evento anterior > 30min.
  // Cada sessão = { inicio, fim } em ms.
  const sessoes: { inicio: number; fim: number }[] = [];
  for (const t of ts) {
    const ultima = sessoes[sessoes.length - 1];
    if (ultima && t - ultima.fim <= GAP_SESSAO_MIN * 60 * 1000) {
      ultima.fim = t;
    } else {
      sessoes.push({ inicio: t, fim: t });
    }
  }

  // Distribui em janelas rolantes de 7 dias (0 = últimos 7 dias). A sessão é
  // atribuída à janela do seu início.
  const janelas = Array.from({ length: SEMANAS }, (_, i) => {
    const fim = agora - i * 7 * DIA_MS;
    const inicio = fim - 7 * DIA_MS;
    return { inicio, fim, palpites: 0, minutos: 0, sessoes: 0, diasSet: new Set<string>() };
  });

  function janelaDe(ms: number) {
    const idx = Math.floor((agora - ms) / (7 * DIA_MS));
    return idx >= 0 && idx < SEMANAS ? janelas[idx] : null;
  }

  for (const t of ts) {
    const j = janelaDe(t);
    if (j) {
      j.palpites += 1;
      j.diasSet.add(new Date(t).toISOString().slice(0, 10));
    }
  }
  for (const s of sessoes) {
    const j = janelaDe(s.inicio);
    if (j) {
      j.sessoes += 1;
      j.minutos += Math.round((s.fim - s.inicio) / 60000) + CAUDA_SESSAO_MIN;
    }
  }

  const semanas = janelas.map((j, i) => ({
    indice: i,                                   // 0 = esta semana
    inicio: new Date(j.inicio).toISOString(),
    fim: new Date(j.fim).toISOString(),
    palpites: j.palpites,
    diasAtivos: j.diasSet.size,
    sessoes: j.sessoes,
    minutosEstimados: j.minutos,
  }));

  const now = agora;
  const cooloffAtivo = !!profile.cooloff_until && new Date(profile.cooloff_until).getTime() > now;
  const autoexcluido = !!profile.self_excluded_until && new Date(profile.self_excluded_until).getTime() > now;

  return NextResponse.json({
    semanas,
    jogoResponsavel: {
      banned: !!profile.banned,
      cooloffAtivo,
      cooloff_until: profile.cooloff_until ?? null,
      autoexcluido,
      self_excluded_until: profile.self_excluded_until ?? null,
    },
  });
}
