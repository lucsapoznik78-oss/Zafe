import { redirect } from "next/navigation";

export default function PrivadasDetailPage({ params }: { params: { id: string } }) {
  redirect(`/apostas-privadas/${params.id}`);
}
