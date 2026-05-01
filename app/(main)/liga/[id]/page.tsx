import { redirect } from "next/navigation";

export default function LigaTopicRedirect({ params }: { params: { id: string } }) {
  redirect(`/topicos/${params.id}`);
}
