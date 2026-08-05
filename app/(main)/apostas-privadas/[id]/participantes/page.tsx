export const dynamic = "force-dynamic";

import { permanentRedirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApostasPrivadasParticipantesRedirect({ params }: PageProps) {
  const { id } = await params;
  permanentRedirect(`/privadas/${id}/participantes`);
}
