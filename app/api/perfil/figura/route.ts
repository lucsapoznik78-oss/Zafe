// POST /api/perfil/figura
//
// Salva o config do avatar-personagem em profiles.figura. Só grava campos que
// estão nas whitelists abaixo — se o front mandar chaves extras ou valores
// fora do catálogo do DiceBear (`avataaars`), a gente descarta. Isso mantém o
// jsonb previsível mesmo sendo schema-less.
//
// Cores hex são validadas por regex e SEMPRE salvas sem `#` (padrão do
// DiceBear). Quem lê (FiguraAvatar) já lida com/sem `#`.
//
// Whitelists refletem o catálogo COMPLETO do avataaars — se surgir opção
// nova numa versão futura, adicionar aqui + no FiguraBuilder.

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const HAIR_STYLES = new Set([
  "noHair", "shortFlat", "shortWaved", "shortCurly", "shortRound",
  "shaggy", "shaggyMullet", "shavedSides",
  "theCaesar", "theCaesarAndSidePart", "sides",
  "bigHair", "curly", "curvy", "bun", "bob", "longButNotTooLong",
  "miaWallace", "straight01", "straight02", "straightAndStrand", "frida",
  "dreads", "dreads01", "dreads02", "fro", "froBand",
  "hijab", "turban", "hat",
  "winterHat1", "winterHat02", "winterHat03", "winterHat04",
]);
const FACIAL_HAIR = new Set([
  "beardLight", "beardMedium", "beardMagestic", "moustacheFancy", "moustacheMagnum",
]);
const CLOTHING = new Set([
  "shirtCrewNeck", "shirtVNeck", "shirtScoopNeck", "hoodie",
  "blazerAndShirt", "blazerAndSweater", "collarAndSweater",
  "graphicShirt", "overall",
]);
const CLOTHING_GRAPHIC = new Set([
  "bat", "bear", "cumbia", "deer", "diamond", "hola",
  "pizza", "resist", "selena", "skull", "skullOutline",
]);
const ACCESSORIES = new Set([
  "prescription01", "prescription02", "round", "sunglasses",
  "wayfarers", "kurt", "eyepatch",
]);
const EYEBROWS = new Set([
  "default", "defaultNatural", "flatNatural",
  "raisedExcited", "raisedExcitedNatural",
  "sadConcerned", "sadConcernedNatural",
  "angry", "angryNatural", "frownNatural",
  "unibrowNatural", "upDown", "upDownNatural",
]);
const EYES = new Set([
  "default", "happy", "wink", "winkWacky", "squint", "surprised",
  "hearts", "side", "close", "cry", "dizzy", "eyeRoll",
]);
const MOUTHS = new Set([
  "default", "smile", "twinkle", "serious", "tongue", "grimace",
  "eating", "sad", "concerned", "disbelief", "screamOpen", "vomit",
]);

// Hex 6 dígitos com # opcional. Aceita também 8 dígitos (RGBA) pra permitir
// "transparente" como fundo (#00000000).
const HEX = /^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

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

  const backgroundColor = pickHex(raw.backgroundColor);
  if (backgroundColor) figura.backgroundColor = backgroundColor;

  const skinColor = pickHex(raw.skinColor);
  if (skinColor) figura.skinColor = skinColor;

  const top = pickEnum(raw.top, HAIR_STYLES);
  if (top) figura.top = top;

  const hairColor = pickHex(raw.hairColor);
  if (hairColor) figura.hairColor = hairColor;

  const facialHair = pickEnum(raw.facialHair, FACIAL_HAIR);
  if (facialHair) figura.facialHair = facialHair;

  const facialHairColor = pickHex(raw.facialHairColor);
  if (facialHairColor) figura.facialHairColor = facialHairColor;

  const clothing = pickEnum(raw.clothing, CLOTHING);
  if (clothing) figura.clothing = clothing;

  const clothesColor = pickHex(raw.clothesColor);
  if (clothesColor) figura.clothesColor = clothesColor;

  const clothingGraphic = pickEnum(raw.clothingGraphic, CLOTHING_GRAPHIC);
  if (clothingGraphic) figura.clothingGraphic = clothingGraphic;

  const accessories = pickEnum(raw.accessories, ACCESSORIES);
  if (accessories) figura.accessories = accessories;

  const accessoriesColor = pickHex(raw.accessoriesColor);
  if (accessoriesColor) figura.accessoriesColor = accessoriesColor;

  const eyebrows = pickEnum(raw.eyebrows, EYEBROWS);
  if (eyebrows) figura.eyebrows = eyebrows;

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
