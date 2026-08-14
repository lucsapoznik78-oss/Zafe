export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
// lucide não tem mais ícones de marca — o @ representa o perfil do Instagram.
import { AtSign, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import CanalUsuario from "@/components/canal/CanalUsuario";

export const metadata = {
  title: "Canal do Usuário | Zafe",
  description: "Fale direto com a equipe Zafe.",
};

export default async function CanalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="py-6 space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-foreground">Canal do Usuário</h1>
        <p className="text-sm text-muted-foreground">
          Sua linha direta com a equipe Zafe. Abra uma conversa e acompanhe a resposta por aqui.
        </p>
      </div>

      <Suspense fallback={null}>
        <CanalUsuario />
      </Suspense>

      <p className="text-xs text-muted-foreground">
        Antes de escrever, talvez a resposta já esteja em{" "}
        <Link href="/ajuda" className="text-primary hover:underline">
          Ajuda e Transparência
        </Link>{" "}
        — histórico de resoluções, Termos e jogo responsável.
      </p>

      <section className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Contato da empresa</h2>
          <p className="text-xs text-muted-foreground">
            A conversa aqui no Canal é o caminho mais rápido — fica registrada e a equipe
            responde por aqui. Se preferir, também estamos nestes canais.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <a
            href="https://www.instagram.com/zafe.app.br"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:border-primary/40 transition-colors"
          >
            <AtSign className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">Instagram</p>
              <p className="text-xs text-muted-foreground truncate">@zafe.app.br</p>
            </div>
          </a>

          <a
            href="mailto:contato@zafe.app"
            className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:border-primary/40 transition-colors"
          >
            <Mail className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">E-mail</p>
              <p className="text-xs text-muted-foreground truncate">contato@zafe.app</p>
            </div>
          </a>
        </div>

        <p className="text-[11px] text-muted-foreground/60">
          A Zafe nunca pede sua senha nem códigos de verificação por Instagram, e-mail ou
          telefone.
        </p>
      </section>
    </div>
  );
}
