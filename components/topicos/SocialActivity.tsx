import { createClient, createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  topicId: string;
  currentUserId?: string;
}

function fmt(n: number) { return `Z$ ${n.toFixed(2)}`; }

export default async function SocialActivity({ topicId, currentUserId }: Props) {
  if (!currentUserId) return null;

  const supabase = await createClient();
  const admin    = createAdminClient();

  // Buscar amigos
  const { data: friendRows } = await supabase
    .from("friendships")
    .select("user_id, friend_id")
    .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
    .eq("status", "accepted");

  const friendIds = (friendRows ?? []).map((r: any) =>
    r.user_id === currentUserId ? r.friend_id : r.user_id
  );

  if (!friendIds.length) return null;

  // Apostas dos amigos neste tópico
  const { data: friendBets } = await admin
    .from("bets")
    .select("id, user_id, side, amount, status, locked_odds")
    .eq("topic_id", topicId)
    .in("user_id", friendIds)
    .in("status", ["pending", "matched", "partial", "won", "lost"])
    .order("amount", { ascending: false })
    .limit(5);

  // Comentários recentes (em destaque = mais recentes com aposta associada)
  const { data: comments } = await supabase
    .from("comments")
    .select("id, content, created_at, user_id, profiles(username, full_name)")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false })
    .limit(3);

  // Perfis dos amigos que apostaram
  const betUserIds = [...new Set((friendBets ?? []).map((b: any) => b.user_id))];
  const { data: profiles } = betUserIds.length
    ? await supabase.from("profiles").select("id, username, full_name").in("id", betUserIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  // Bet dos comentadores (para mostrar o lado ao lado do comentário)
  const commentUserIds = [...new Set((comments ?? []).map((c: any) => c.user_id))];
  const { data: commentBets } = commentUserIds.length
    ? await admin.from("bets")
        .select("user_id, side")
        .eq("topic_id", topicId)
        .in("user_id", commentUserIds)
        .in("status", ["pending", "matched", "partial", "won", "lost"])
        .limit(20)
    : { data: [] };
  const commentBetMap = new Map((commentBets ?? []).map((b: any) => [b.user_id, b.side]));

  const hasFriendBets = (friendBets ?? []).length > 0;
  const hasComments   = (comments ?? []).length > 0;

  if (!hasFriendBets && !hasComments) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">

      {/* Amigos que apostaram */}
      {hasFriendBets && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Users size={13} />
            Seus amigos palpitaram
          </div>
          <div className="space-y-2">
            {(friendBets ?? []).map((bet: any) => {
              const profile = profileMap.get(bet.user_id);
              const name    = profile?.full_name ?? profile?.username ?? "Usuário";
              const isSim   = bet.side === "sim";
              return (
                <div key={bet.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSim ? "bg-sim" : "bg-nao"}`} />
                    <Link
                      href={`/u/${profile?.username}`}
                      className="text-xs text-white font-medium hover:text-primary transition-colors truncate"
                    >
                      {name}
                    </Link>
                    <span className={`text-[10px] font-bold shrink-0 ${isSim ? "text-sim" : "text-nao"}`}>
                      {bet.side.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{fmt(parseFloat(bet.amount))}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Link
                      href={`/topicos/${topicId}?side=${bet.side}`}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                        isSim
                          ? "bg-sim/15 text-sim hover:bg-sim/25"
                          : "bg-nao/15 text-nao hover:bg-nao/25"
                      }`}
                    >
                      Concordar
                    </Link>
                    <Link
                      href={`/topicos/${topicId}?side=${bet.side === "sim" ? "nao" : "sim"}`}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground hover:text-white transition-colors"
                    >
                      Discordar
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Divider */}
      {hasFriendBets && hasComments && <div className="border-t border-border/40" />}

      {/* Comentários em destaque */}
      {hasComments && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <MessageSquare size={13} />
            Em discussão
          </div>
          <div className="space-y-2.5">
            {(comments ?? []).map((c: any) => {
              const name = c.profiles?.full_name ?? c.profiles?.username ?? "Usuário";
              const side = commentBetMap.get(c.user_id);
              return (
                <div key={c.id} className="flex gap-2">
                  <div className={`w-0.5 shrink-0 rounded-full mt-0.5 ${
                    side === "sim" ? "bg-sim" : side === "nao" ? "bg-nao" : "bg-border"
                  }`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] font-semibold text-white">{name}</span>
                      {side && (
                        <span className={`text-[9px] font-bold ${side === "sim" ? "text-sim" : "text-nao"}`}>
                          {side.toUpperCase()}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{c.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
