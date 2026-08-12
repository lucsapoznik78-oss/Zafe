"use client";

// FiguraBuilder — editor split-screen do avatar-personagem (estilo FIFA
// creation: preview grande à esquerda, categorias à direita).
//
// Envia o JSON pra POST /api/perfil/figura ao salvar. Nada é gerado no server
// e nada de bytes de imagem — só o config. O SVG vive no client, redesenhado
// a cada mudança pelo FiguraAvatar.
//
// Opções vieram do próprio catálogo do estilo `avataaars` do DiceBear. Escolhi
// um subconjunto grande o suficiente pra caras variarem bem, sem virar UI de
// mil botões. Se quiser expor mais amanhã, é só somar entrada aqui — nada
// muda no schema (figura é jsonb livre; o server só valida shape).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FiguraAvatar, { type FiguraConfig } from "./FiguraAvatar";
import { Shuffle, Save, X } from "lucide-react";

const CATEGORIAS = ["Rosto", "Cabelo", "Barba", "Roupa", "Óculos", "Expressão"] as const;
type Categoria = (typeof CATEGORIAS)[number];

const SKIN_COLORS   = ["#f8d25c", "#fd9841", "#ffdbb4", "#edb98a", "#d08b5b", "#ae5d29", "#614335"];
const HAIR_STYLES   = [
  { v: "shortFlat",       l: "Curto liso" },
  { v: "shortWaved",      l: "Curto ondulado" },
  { v: "shortCurly",      l: "Curto cacheado" },
  { v: "shortRound",      l: "Redondinho" },
  { v: "shaggy",          l: "Bagunçado" },
  { v: "theCaesar",       l: "Cesarinho" },
  { v: "sides",           l: "Lateral" },
  { v: "bigHair",         l: "Volumoso" },
  { v: "curly",           l: "Cacheado" },
  { v: "bun",             l: "Coque" },
  { v: "bob",             l: "Chanel" },
  { v: "longButNotTooLong", l: "Longo" },
  { v: "dreads",          l: "Dreads" },
  { v: "fro",             l: "Fro" },
  { v: "hijab",           l: "Hijab" },
  { v: "turban",          l: "Turbante" },
  { v: "winterHat01",     l: "Gorro" },
  { v: "noHair",          l: "Careca" },
];
const HAIR_COLORS   = ["#2c1b18", "#4a312c", "#724133", "#a55728", "#b58143", "#c93305", "#d6b370", "#ecdcbf"];
const FACIAL_HAIR   = [
  { v: "",               l: "Sem barba" },
  { v: "beardLight",     l: "Leve" },
  { v: "beardMedium",    l: "Média" },
  { v: "beardMagestic",  l: "Majestosa" },
  { v: "moustacheFancy", l: "Bigode" },
  { v: "moustacheMagnum",l: "Bigodão" },
];
const CLOTHING      = [
  { v: "shirtCrewNeck",  l: "Camiseta" },
  { v: "shirtVNeck",     l: "Gola V" },
  { v: "shirtScoopNeck", l: "Cavada" },
  { v: "hoodie",         l: "Moletom" },
  { v: "blazerAndShirt", l: "Blazer" },
  { v: "collarAndSweater", l: "Suéter" },
  { v: "graphicShirt",   l: "Estampada" },
  { v: "overall",        l: "Jardineira" },
];
const CLOTHES_COLORS = ["#5199e4", "#25557c", "#65c9ff", "#ff488e", "#ff5c5c", "#a7ffc4", "#ffffb1", "#262e33", "#e6e6e6", "#ffffff"];
const ACCESSORIES   = [
  { v: "",               l: "Sem óculos" },
  { v: "prescription01", l: "Redondos" },
  { v: "prescription02", l: "Retangulares" },
  { v: "round",          l: "Ray-ban" },
  { v: "sunglasses",     l: "Escuros" },
  { v: "wayfarers",      l: "Wayfarer" },
  { v: "eyepatch",       l: "Tapa-olho" },
];
const EYES          = [
  { v: "default",   l: "Normal" },
  { v: "happy",     l: "Feliz" },
  { v: "wink",      l: "Piscada" },
  { v: "squint",    l: "Apertados" },
  { v: "surprised", l: "Surpreso" },
  { v: "hearts",    l: "Corações" },
  { v: "side",      l: "De lado" },
  { v: "closed",    l: "Fechados" },
];
const MOUTHS        = [
  { v: "default",  l: "Normal" },
  { v: "smile",    l: "Sorriso" },
  { v: "twinkle",  l: "Radiante" },
  { v: "serious",  l: "Sério" },
  { v: "tongue",   l: "Língua" },
  { v: "grimace",  l: "Careta" },
  { v: "eating",   l: "Comendo" },
];

function randomItem<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomSeed(): string { return Math.random().toString(36).slice(2, 10); }

function randomFigura(): FiguraConfig {
  return {
    seed:            randomSeed(),
    skinColor:       randomItem(SKIN_COLORS).slice(1),
    top:             randomItem(HAIR_STYLES).v,
    hairColor:       randomItem(HAIR_COLORS),
    facialHair:      randomItem(FACIAL_HAIR).v,
    clothing:        randomItem(CLOTHING).v,
    clothesColor:    randomItem(CLOTHES_COLORS),
    accessories:     randomItem(ACCESSORIES).v,
    eyes:            randomItem(EYES).v,
    mouth:           randomItem(MOUTHS).v,
  };
}

interface Props {
  figuraInicial: FiguraConfig | null;
  onClose: () => void;
}

export default function FiguraBuilder({ figuraInicial, onClose }: Props) {
  const router = useRouter();
  const [figura, setFigura] = useState<FiguraConfig>(
    figuraInicial ?? randomFigura()
  );
  const [cat, setCat] = useState<Categoria>("Rosto");
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function set<K extends keyof FiguraConfig>(k: K, v: FiguraConfig[K]) {
    setFigura((f) => ({ ...f, [k]: v }));
  }

  async function salvar() {
    setErro(null);
    startTransition(async () => {
      const res = await fetch("/api/perfil/figura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figura }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErro(j.error ?? "Erro ao salvar.");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-3xl my-6 flex flex-col md:flex-row overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview (esquerda / topo no mobile) */}
        <div className="bg-gradient-to-br from-primary/15 to-black/60 md:w-[45%] p-6 flex flex-col items-center justify-center gap-4 border-b md:border-b-0 md:border-r border-border">
          <div className="bg-white/5 rounded-2xl p-3 shadow-inner">
            <FiguraAvatar figura={figura} size={220} />
          </div>
          <button
            onClick={() => setFigura(randomFigura())}
            className="flex items-center gap-2 text-xs bg-white/5 hover:bg-white/10 border border-border rounded-full px-3 py-1.5 text-white transition-colors"
          >
            <Shuffle size={12} /> Sortear tudo
          </button>
        </div>

        {/* Controles (direita / abaixo no mobile) */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-sm font-bold text-white">Monte seu personagem</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-white p-1"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Abas de categoria */}
          <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
            {CATEGORIAS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  cat === c ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Corpo de opções */}
          <div className="p-4 space-y-4 overflow-y-auto max-h-[45vh]">
            {cat === "Rosto" && (
              <>
                <Grupo label="Tom de pele">
                  <SwatchRow
                    valores={SKIN_COLORS}
                    selecionado={figura.skinColor ? `#${figura.skinColor}` : undefined}
                    onSelect={(c) => set("skinColor", c.slice(1))}
                  />
                </Grupo>
              </>
            )}
            {cat === "Cabelo" && (
              <>
                <Grupo label="Estilo">
                  <ChipRow
                    valores={HAIR_STYLES}
                    selecionado={figura.top}
                    onSelect={(v) => set("top", v)}
                  />
                </Grupo>
                <Grupo label="Cor">
                  <SwatchRow
                    valores={HAIR_COLORS}
                    selecionado={figura.hairColor}
                    onSelect={(c) => set("hairColor", c)}
                  />
                </Grupo>
              </>
            )}
            {cat === "Barba" && (
              <Grupo label="Estilo">
                <ChipRow
                  valores={FACIAL_HAIR}
                  selecionado={figura.facialHair ?? ""}
                  onSelect={(v) => set("facialHair", v)}
                />
              </Grupo>
            )}
            {cat === "Roupa" && (
              <>
                <Grupo label="Tipo">
                  <ChipRow
                    valores={CLOTHING}
                    selecionado={figura.clothing}
                    onSelect={(v) => set("clothing", v)}
                  />
                </Grupo>
                <Grupo label="Cor">
                  <SwatchRow
                    valores={CLOTHES_COLORS}
                    selecionado={figura.clothesColor}
                    onSelect={(c) => set("clothesColor", c)}
                  />
                </Grupo>
              </>
            )}
            {cat === "Óculos" && (
              <Grupo label="Acessório">
                <ChipRow
                  valores={ACCESSORIES}
                  selecionado={figura.accessories ?? ""}
                  onSelect={(v) => set("accessories", v)}
                />
              </Grupo>
            )}
            {cat === "Expressão" && (
              <>
                <Grupo label="Olhos">
                  <ChipRow
                    valores={EYES}
                    selecionado={figura.eyes}
                    onSelect={(v) => set("eyes", v)}
                  />
                </Grupo>
                <Grupo label="Boca">
                  <ChipRow
                    valores={MOUTHS}
                    selecionado={figura.mouth}
                    onSelect={(v) => set("mouth", v)}
                  />
                </Grupo>
              </>
            )}
          </div>

          {/* Ações */}
          <div className="p-4 border-t border-border flex flex-col gap-2">
            {erro && <p className="text-xs text-nao">{erro}</p>}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-semibold text-muted-foreground hover:text-white border border-border rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={pending}
                className="flex-1 py-2.5 text-sm font-bold bg-primary text-black rounded-lg hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save size={14} />
                {pending ? "Salvando…" : "Salvar personagem"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Grupo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function SwatchRow({
  valores,
  selecionado,
  onSelect,
}: {
  valores: string[];
  selecionado?: string;
  onSelect: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {valores.map((c) => {
        const sel = selecionado?.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            onClick={() => onSelect(c)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              sel ? "border-primary scale-110" : "border-border hover:border-white/40"
            }`}
            style={{ background: c }}
            aria-label={c}
          />
        );
      })}
    </div>
  );
}

function ChipRow({
  valores,
  selecionado,
  onSelect,
}: {
  valores: { v: string; l: string }[];
  selecionado?: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {valores.map(({ v, l }) => {
        const sel = (selecionado ?? "") === v;
        return (
          <button
            key={v || "none"}
            onClick={() => onSelect(v)}
            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-md border transition-colors ${
              sel
                ? "bg-primary/20 text-primary border-primary/50"
                : "bg-white/5 text-muted-foreground border-border hover:text-white hover:border-white/40"
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
