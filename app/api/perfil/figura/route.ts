// POST /api/perfil/figura
//
// Salva o config do avatar-personagem em profiles.figura. Só grava campos que
// estão nas whitelists abaixo — se o front mandar chaves extras ou valores
// fora do catálogo do DiceBear (`avataaars`), a gente descarta. Isso mantém o
// jsonb previsível mesmo sendo schema-less.
//
// Cores hex são validadas por regex e SEMPRE salvas sem `#` (padrão do
// DiceBear). Quem lê (FiguraAvatar) já lida com/sem `#`.

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const HAIR_STYLES = new Set([
  "shortFlat", "shortWaved", "shortCurly", "shortRound", "shaggy", "theCaesar",
  "sides", "bigHair", "curly", "bun", "bob", "longButNotTooLong", "dreads",
  "fro", "hijab", "turban", "winterHat01", "noHair",
]);
const FACIAL_HAIR = new Set([
  "beardLight", "beardMedium", "beardMagestic", "moustacheFancy", "moustacheMagnum",
]);
const CLOTHING = new Set([
  "shirtCrewNeck", "shirtVNeck", "shirtScoopNeck", "hoodie", "blazerAndShirt",
  "collarAndSweater", "graphicShirt", "overall",
]);
const ACCESSORIES = new Set([
  "prescription01", "prescription02", "round", "sunglasses", "wayfarers", "eyepatch",
]);
const EYES = new Set([
  "default", "happy", "wink", "squint", "surprised", "hearts", "side", "closed",
]);
const MOUTHS = new Set([
  "default", "smile", "twinkle", "serious", "tongue", "grimace", "eating",
]);

const HEX = /^#?[0-9a-fA-F]{6}$/;

function pickHex(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  if (!HEX.test(v)) return undefined;
  return v.startsWith("#") ? v.slice(1) : v;
}
function pickEnum(v: unknown, set: Set<string>): string | undefined {
  if (typeof v !== "string") return undefined;
  return set.has(v) ? v : undefined;
}
function pickSeed(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  // seed: só alfanumérico, até 32 chars — evita XSS mesmo hoje ninguém injetar
  // via seed (DiceBear a usa como sal), mas é dado do usuário indo pro banco.
  const clean = v.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
  return clean || undefined;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const raw = (body as { figura?: Record<string, unknown> })?.figura;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "figura obrigatória" }, { status: 400 });
  }

  const figura: Record<string, string> = {};
  const seed = pickSeed(raw.seed);
  if (seed) figura.seed = seed;

  const skinColor = pickHex(raw.skinColor);
  if (skinColor) figura.skinColor = skinColor;

  const top = pickEnum(raw.top, HAIR_STYLES);
  if (top) figura.top = top;

  const hairColor = pickHex(raw.hairColor);
  if (hairColor) figura.hairColor = hairColor;

  const facialHair = pickEnum(raw.facialHair, FACIAL_HAIR);
  if (facialHair) figura.facialHair = facialHair;

  const clothing = pickEnum(raw.clothing, CLOTHING);
  if (clothing) figura.clothing = clothing;

  const clothesColor = pickHex(raw.clothesColor);
  if (clothesColor) figura.clothesColor = clothesColor;

  const accessories = pickEnum(raw.accessories, ACCESSORIES);
  if (accessories) figura.accessories = accessories;

  const eyes = pickEnum(raw.eyes, EYES);
  if (eyes) figura.eyes = eyes;

  const mouth = pickEnum(raw.mouth, MOUTHS);
  if (mouth) figura.mouth = mouth;

  if (!figura.seed) figura.seed = user.id.slice(0, 8);

  const { error } = await supabase
    .from("profiles")
    .update({ figura })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Erro ao salvar personagem" }, { status: 500 });
  }

  return NextResponse.json({ success: true, figura });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { error } = await supabase
    .from("profiles")
    .update({ figura: null })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Erro ao remover personagem" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
