export const dynamic = "force-dynamic";

import { EventParticipantsPage } from "@/components/topicos/EventParticipantsPage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LigaParticipantesPage({ params }: PageProps) {
  const { id } = await params;
  return <EventParticipantsPage id={id} pillar="liga" />;
}
