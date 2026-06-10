export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CopaAdminPanel from "@/components/admin/CopaAdminPanel";
import { COPA_SLUG } from "@/lib/copa/queries";

export default async function AdminCopaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/liga");

  const admin = createAdminClient();

  const { data: competition } = await admin
    .from("copa_competition")
    .select("*")
    .eq("slug", COPA_SLUG)
    .single();

  if (!competition) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-zinc-400">
        Competição não encontrada — aplique a migration 027_copa_core.sql.
      </div>
    );
  }

  const [{ data: matches }, { count: participants }, { data: reviewLogs }] =
    await Promise.all([
      admin
        .from("copa_matches")
        .select("*")
        .eq("competition_id", competition.id)
        .order("kickoff_at", { ascending: true })
        .order("match_number", { ascending: true }),
      admin
        .from("copa_participants")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", competition.id),
      admin
        .from("copa_resolution_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

  return (
    <CopaAdminPanel
      competition={competition}
      matches={matches ?? []}
      participants={participants ?? 0}
      reviewLogs={reviewLogs ?? []}
    />
  );
}
