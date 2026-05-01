import { redirect } from "next/navigation";

export default function EconomicoTopicRedirect({ params }: { params: { id: string } }) {
  redirect(`/topicos/${params.id}`);
}
