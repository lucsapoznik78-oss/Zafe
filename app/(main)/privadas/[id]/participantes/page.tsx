export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { EventParticipantsPage } from "@/components/topicos/EventParticipantsPage";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PrivadasParticipantesPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <EventParticipantsPage id={id} pillar="privadas" privateAccessUserId={user.id} />;
}
