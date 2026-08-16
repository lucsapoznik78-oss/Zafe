/**
 * POST /api/perfil/figura — salva o personagem v2 (JSON) + os dois PNGs.
 * DELETE /api/perfil/figura — apaga o personagem, MAS não o que foi pago.
 *
 * Multipart porque este é o único lugar do app onde o usuário entrega BYTES: o
 * navegador fotografa o canvas 3D em dois enquadramentos (retrato para navbar e
 * ranking, corpo inteiro para o perfil) e sobe os dois junto com a figura.
 *
 * Três coisas aqui não são detalhe:
 *
 * 1. Item que não passa é DESCARTADO, não rejeitado (ver lib/figura/validar.ts).
 *    Um save nunca pode falhar inteiro por causa de um id velho.
 * 2. O PNG é conferido pelos 8 primeiros BYTES, não pelo `type` do arquivo — o
 *    `type` vem do cliente e é só uma string.
 * 3. UPLOAD PRIMEIRO, linha depois. Caminho fixo com upsert: se a linha falhar
 *    depois do upload, o próximo save sobrescreve e não sobra órfão. Na ordem
 *    inversa a falha é visível ao público — o JSON diz "de coroa" e o PNG que
 *    todo mundo vê, não.
 */
import { NextResponse } from "next/server";

import { sanearFigura } from "@/lib/figura/validar";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "avatares";

/** Tetos generosos: 128x128 e 512x768 de blocos chapados comprimem muito. */
const TETO = { retrato: 512 * 1024, corpo: 2 * 1024 * 1024 };

/** Assinatura PNG: \x89 P N G \r \n \x1a \n */
const MAGIA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Piso de tamanho. Quando o Safari derruba o contexto WebGL sob pressão de
 * memória, `toBlob` devolve um PNG perfeitamente válido e totalmente
 * transparente — a assinatura passa, e um quadrado vazio vira o avatar de
 * alguém. Um PNG desses fica na casa de centenas de bytes.
 */
const PISO = 1024;

async function lerPng(
  fd: FormData,
  campo: "retrato" | "corpo",
): Promise<{ buf: Buffer } | { erro: string }> {
  const f = fd.get(campo);
  if (!(f instanceof Blob)) return { erro: `${campo} obrigatório` };
  if (f.size > TETO[campo]) return { erro: `${campo} grande demais` };
  if (f.size < PISO) return { erro: `${campo} veio vazio — tente salvar de novo` };

  const buf = Buffer.from(await f.arrayBuffer());
  if (buf.length < 8 || MAGIA_PNG.some((b, i) => buf[i] !== b)) {
    return { erro: `${campo} não é um PNG` };
  }
  return { buf };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();

  const { data: perfil } = await admin
    .from("profiles")
    .select("figura_desbloqueada")
    .eq("id", user.id)
    .single();
  if (!perfil?.figura_desbloqueada) {
    return NextResponse.json({ error: "Desbloqueie o personagem primeiro" }, { status: 403 });
  }

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  let bruto: unknown;
  try {
    bruto = JSON.parse(String(fd.get("figura") ?? ""));
  } catch {
    return NextResponse.json({ error: "figura inválida" }, { status: 400 });
  }

  const { data: inv } = await admin
    .from("figura_inventario")
    .select("item_id")
    .eq("user_id", user.id);
  const inventario = new Set((inv ?? []).map((r) => r.item_id as string));

  const { figura, descartados } = sanearFigura(bruto, inventario);

  // `nao_possui` é id real que o usuário não comprou: tentativa de vestir sem
  // pagar. `desconhecido` é aba velha e não interessa a ninguém.
  const exploit = descartados.filter((d) => d.motivo === "nao_possui");
  if (exploit.length > 0) {
    console.warn(
      `[figura] ${user.id} tentou equipar ${exploit.length} item(ns) fora do inventário:`,
      exploit.map((d) => `${d.slot}=${d.itemId}`).join(", "),
    );
  }

  const retrato = await lerPng(fd, "retrato");
  if ("erro" in retrato) return NextResponse.json({ error: retrato.erro }, { status: 400 });
  const corpo = await lerPng(fd, "corpo");
  if ("erro" in corpo) return NextResponse.json({ error: corpo.erro }, { status: 400 });

  const base = `personagem/${user.id}`;
  const up = await Promise.all(
    (
      [
        [`${base}/retrato.png`, retrato.buf],
        [`${base}/corpo.png`, corpo.buf],
      ] as const
    ).map(([caminho, buf]) =>
      admin.storage.from(BUCKET).upload(caminho, buf, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: true,
      }),
    ),
  );
  if (up.some((r) => r.error)) {
    return NextResponse.json({ error: "Erro ao subir a imagem" }, { status: 500 });
  }

  // O caminho é fixo, então a CDN serviria a foto anterior por um ano. O `?v=`
  // é o que faz a troca aparecer agora sem abrir mão do cache longo.
  const v = Date.now();
  const url = (caminho: string) =>
    `${admin.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl}?v=${v}`;

  const figura_url = url(`${base}/corpo.png`);
  const figura_retrato_url = url(`${base}/retrato.png`);

  const { error } = await admin
    .from("profiles")
    .update({ figura, figura_url, figura_retrato_url })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Erro ao salvar personagem" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    figura,
    figura_url,
    figura_retrato_url,
    descartados,
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();

  // Deliberadamente NÃO mexe em `figura_desbloqueada` nem em
  // `figura_inventario`: o usuário pagou por aquilo. Apagar aqui seria cobrar
  // Z$ 100 de novo de quem só quis limpar o boneco.
  const { error } = await admin
    .from("profiles")
    .update({ figura: null, figura_url: null, figura_retrato_url: null })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Erro ao remover personagem" }, { status: 500 });
  }

  await admin.storage
    .from(BUCKET)
    .remove([`personagem/${user.id}/retrato.png`, `personagem/${user.id}/corpo.png`]);

  return NextResponse.json({ success: true });
}
