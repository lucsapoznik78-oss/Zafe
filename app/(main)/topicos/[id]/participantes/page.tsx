export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TopicosParticipantesRedirect({ params }: PageProps) {
  const { id } = await params;
  const admin = createAdminClient();

  const isUUID = /^[0-9a-f-]{36}$/.test(id);
  const query = admin.from("topics").select("id, category, slug");
  const { data: topic } = isUUID
    ? await query.eq("id", id).single()
    : await query.eq("slug", id).single();

  if (!topic) redirect("/liga");

  const canonicalId = topic.slug ?? topic.id;
  if (topic.category === "economia") {
    redirect(`/economico/${canonicalId}/participantes`);
  }

  redirect(`/liga/${canonicalId}/participantes`);
}
