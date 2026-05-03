export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { TopicDetailPage } from "@/components/topicos/TopicDetailPage";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ side?: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const isUUID = /^[0-9a-f-]{36}$/.test(id);
  const query = supabase.from("topics").select("title, description, category");
  const { data: topic } = isUUID
    ? await query.eq("id", id).single()
    : await query.eq("slug", id).single();

  if (!topic) return { title: "Evento não encontrado — Zafe" };
  const desc = topic.description
    ? topic.description.slice(0, 160)
    : `Preveja o resultado deste evento e compita na liga de previsões do Zafe.`;
  const resolvedId = isUUID ? id : (await supabase.from("topics").select("id").eq("slug", id).single())?.data?.id ?? id;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://zafe-rho.vercel.app";
  const ogImage = `${appUrl}/api/og?id=${resolvedId}&type=liga`;
  const canonicalUrl = `${appUrl}/liga/${resolvedId}`;
  return {
    title: topic.title,
    description: desc,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${topic.title} — Zafe Liga`,
      description: desc,
      type: "website",
      url: canonicalUrl,
      images: [{ url: ogImage, width: 1200, height: 630, alt: topic.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${topic.title} — Zafe Liga`,
      description: desc,
      images: [ogImage],
    },
  };
}

export default async function LigaDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { side } = await searchParams;
  const initialSide = side === "sim" || side === "nao" ? side : undefined;
  return <TopicDetailPage id={id} initialSide={initialSide} />;
}
