import { redirect } from "next/navigation";

interface PageProps { params: Promise<{ id: string }> }

export default async function ApostaPrivadaRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/privadas/${id}`);
}
