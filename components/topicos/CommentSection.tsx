"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Comment } from "@/types/database";

export default function CommentSection({ topicId }: { topicId: string }) {
  const supabase = createClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    loadComments();

    const channel = supabase
      .channel(`comments:${topicId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments", filter: `topic_id=eq.${topicId}` },
        () => loadComments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [topicId]);

  async function loadComments() {
    const { data } = await supabase
      .from("comments")
      .select("*, profiles(username, full_name)")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setComments(data as Comment[]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !userId) return;
    setLoading(true);
    await supabase.from("comments").insert({ topic_id: topicId, user_id: userId, content: content.trim() });
    setContent("");
    setLoading(false);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white">Discussão ({comments.length})</h3>

      {userId && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Adicione um comentário..."
            className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="px-3 py-2 bg-primary text-black rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {comments.map((comment) => {
          const name = comment.profiles?.full_name ?? comment.profiles?.username ?? "Usuário";
          const initials = name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
          return (
            <div key={comment.id} className="flex gap-2.5">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-white">{name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{comment.content}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
