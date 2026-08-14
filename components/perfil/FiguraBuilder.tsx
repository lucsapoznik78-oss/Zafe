"use client";

// FiguraBuilder — editor rico do avatar-personagem, inspirado no character
// customization do GeoGuessr: cada opção mostra uma mini-preview do PRÓPRIO
// personagem do usuário com aquela opção aplicada. Ver a mudança antes de
// clicar é o que faz o builder parecer "vivo" em vez de uma lista de nomes.
//
// Arquitetura:
//   - preview grande à esquerda (o boneco atual, em tamanho fifa-creation)
//   - 7 abas à direita (Corpo · Cabelo · Rosto · Barba · Roupa · Óculos · Fundo)
//   - cada opção = <FiguraAvatar> pequeno com {...figura, [campo]: opcao}
//   - React.memo nos chips pra não re-renderizar 30 SVGs a cada hover
//   - "sortear categoria" e "sortear tudo" pra descoberta rápida
//
// Catálogo é o do DiceBear `avataaars` na íntegra (ou quase). Se surgir opção
// nova numa versão futura, adicionar aqui + no whitelist do POST /api/perfil/figura.

import { memo, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FiguraAvatar, { type FiguraConfig } from "./FiguraAvatar";
import { Shuffle, Save, X } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo completo do avataaars
// ─────────────────────────────────────────────────────────────────────────────

const SKIN_COLORS = [
  "#614335", "#ae5d29", "#d08b5b", "#edb98a", "#ffdbb4", "#fd9841", "#f8d25c",
];

const HAIR_COLORS = [
  "#2c1b18", "#4a312c", "#724133", "#a55728", "#b58143",
  "#c93305", "#d6b370", "#ecdcbf", "#e8e1e1", "#f59797",
];

const CLOTHES_COLORS = [
  "#262e33", "#3c4f5c", "#5199e4", "#25557c", "#65c9ff",
  "#929598", "#a7ffc4", "#b1e2ff", "#e6e6e6", "#ff488e",
  "#ff5c5c", "#ffafb9", "#ffffb1", "#ffffff",
];

const BG_COLORS = [
  "#00000000", // transparente
  "#b6e3f4", "#c0aede", "#d1d4f9", "#ffd5dc", "#ffdfbf",
  "#e0e0e0", "#fef3c7", "#bbf7d0", "#000000",
];

const HAIR_STYLES = [
  { v: "noHair",              l: "Careca" },
  { v: "shortFlat",           l: "Curto liso" },
  { v: "shortWaved",          l: "Curto ondulado" },
  { v: "shortCurly",          l: "Curto cacheado" },
  { v: "shortRound",          l: "Redondinho" },
  { v: "shaggy",              l: "Bagunçado" },
  { v: "shaggyMullet",        l: "Mullet" },
  { v: "shavedSides",         l: "Laterais raspadas" },
  { v: "theCaesar",           l: "Cesarinho" },
  { v: "theCaesarAndSidePart", l: "César + risca" },
  { v: "sides",               l: "Lateral" },
  { v: "bigHair",             l: "Volumoso" },
  { v: "curly",               l: "Cacheado" },
  { v: "curvy",               l: "Cheio" },
  { v: "bun",                 l: "Coque" },
  { v: "bob",                 l: "Chanel" },
  { v: "longButNotTooLong",   l: "Longo" },
  { v: "miaWallace",          l: "Franjão" },
  { v: "straight01",          l: "Liso 1" },
  { v: "straight02",          l: "Liso 2" },
  { v: "straightAndStrand",   l: "Liso c/ mecha" },
  { v: "frida",               l: "Frida" },
  { v: "dreads",              l: "Dreads" },
  { v: "dreads01",            l: "Dreads curtos" },
  { v: "dreads02",            l: "Dreads longos" },
  { v: "fro",                 l: "Black power" },
  { v: "froBand",             l: "Fro c/ faixa" },
  { v: "hijab",               l: "Hijab" },
  { v: "turban",              l: "Turbante" },
  { v: "hat",                 l: "Chapéu" },
  { v: "winterHat1",          l: "Gorro 1" },
  { v: "winterHat02",         l: "Gorro 2" },
  { v: "winterHat03",         l: "Gorro 3" },
  { v: "winterHat04",         l: "Gorro 4" },
];

const FACIAL_HAIR = [
  { v: "",                l: "Sem" },
  { v: "beardLight",      l: "Leve" },
  { v: "beardMedium",     l: "Média" },
  { v: "beardMagestic",   l: "Majestosa" },
  { v: "moustacheFancy",  l: "Bigode" },
  { v: "moustacheMagnum", l: "Bigodão" },
];

const CLOTHING = [
  { v: "shirtCrewNeck",    l: "Camiseta" },
  { v: "shirtVNeck",       l: "Gola V" },
  { v: "shirtScoopNeck",   l: "Cavada" },
  { v: "hoodie",           l: "Moletom" },
  { v: "blazerAndShirt",   l: "Blazer" },
  { v: "blazerAndSweater", l: "Blazer + suéter" },
  { v: "collarAndSweater", l: "Suéter" },
  { v: "graphicShirt",     l: "Estampada" },
  { v: "overall",          l: "Jardineira" },
];

const CLOTHING_GRAPHIC = [
  { v: "",             l: "Sem" },
  { v: "bat",          l: "Morcego" },
  { v: "bear",         l: "Urso" },
  { v: "cumbia",       l: "Cúmbia" },
  { v: "deer",         l: "Cervo" },
  { v: "diamond",      l: "Diamante" },
  { v: "hola",         l: "Hola" },
  { v: "pizza",        l: "Pizza" },
  { v: "resist",       l: "Resist" },
  { v: "selena",       l: "Selena" },
  { v: "skull",        l: "Caveira" },
  { v: "skullOutline", l: "Caveira line" },
];

const ACCESSORIES = [
  { v: "",               l: "Sem" },
  { v: "prescription01", l: "Redondos" },
  { v: "prescription02", l: "Retangulares" },
  { v: "round",          l: "Ray-ban" },
  { v: "sunglasses",     l: "Escuros" },
  { v: "wayfarers",      l: "Wayfarer" },
  { v: "kurt",           l: "Kurt" },
  { v: "eyepatch",       l: "Tapa-olho" },
];

const EYEBROWS = [
  { v: "default",              l: "Padrão" },
  { v: "defaultNatural",       l: "Natural" },
  { v: "flatNatural",          l: "Retas" },
  { v: "raisedExcited",        l: "Erguidas" },
  { v: "raisedExcitedNatural", l: "Erguidas nat." },
  { v: "sadConcerned",         l: "Preocupadas" },
  { v: "sadConcernedNatural",  l: "Preocupadas nat." },
  { v: "angry",                l: "Bravas" },
  { v: "angryNatural",         l: "Bravas nat." },
  { v: "frownNatural",         l: "Franzidas" },
  { v: "unibrowNatural",       l: "Monocelha" },
  { v: "upDown",               l: "Assimétricas" },
  { v: "upDownNatural",        l: "Assim. nat." },
];

const EYES = [
  { v: "default",   l: "Padrão" },
  { v: "happy",     l: "Feliz" },
  { v: "wink",      l: "Piscada" },
  { v: "winkWacky", l: "Piscada 2" },
  { v: "squint",    l: "Apertados" },
  { v: "surprised", l: "Surpreso" },
  { v: "hearts",    l: "Corações" },
  { v: "side",      l: "De lado" },
  { v: "close",     l: "Fechados" },
  { v: "cry",       l: "Chorando" },
  { v: "dizzy",     l: "Tontos" },
  { v: "eyeRoll",   l: "Rolando" },
];

const MOUTHS = [
  { v: "default",    l: "Padrão" },
  { v: "smile",      l: "Sorriso" },
  { v: "twinkle",    l: "Radiante" },
  { v: "serious",    l: "Sério" },
  { v: "tongue",     l: "Língua" },
  { v: "grimace",    l: "Careta" },
  { v: "eating",     l: "Comendo" },
  { v: "sad",        l: "Triste" },
  { v: "concerned",  l: "Preocupado" },
  { v: "disbelief",  l: "Descrente" },
  { v: "screamOpen", l: "Gritando" },
  { v: "vomit",      l: "Vomit" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Abas
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIAS = [
  "Corpo", "Cabelo", "Rosto", "Barba", "Roupa", "Óculos", "Fundo",
] as const;
type Categoria = (typeof CATEGORIAS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function randomItem<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomSeed(): string { return Math.random().toString(36).slice(2, 10); }

function randomFigura(): FiguraConfig {
  return {
    seed:             randomSeed(),
    backgroundColor:  randomItem(BG_COLORS),
    skinColor:        randomItem(SKIN_COLORS).slice(1),
    top:              randomItem(HAIR_STYLES).v,
    hairColor:        randomItem(HAIR_COLORS),
    facialHair:       randomItem(FACIAL_HAIR).v,
    facialHairColor:  randomItem(HAIR_COLORS),
    clothing:         randomItem(CLOTHING).v,
    clothesColor:     randomItem(CLOTHES_COLORS),
    clothingGraphic:  randomItem(CLOTHING_GRAPHIC).v,
    accessories:      randomItem(ACCESSORIES).v,
    accessoriesColor: randomItem(CLOTHES_COLORS),
    eyebrows:         randomItem(EYEBROWS).v,
    eyes:             randomItem(EYES).v,
    mouth:            randomItem(MOUTHS).v,
  };
}

// Sorteia SÓ os campos de uma categoria. Manter as outras escolhas do usuário
// intactas é essencial pra "sortear cabelo" não bagunçar a roupa.
function randomizarCategoria(f: FiguraConfig, cat: Categoria): FiguraConfig {
  switch (cat) {
    case "Corpo":
      return { ...f, skinColor: randomItem(SKIN_COLORS).slice(1) };
    case "Cabelo":
      return { ...f, top: randomItem(HAIR_STYLES).v, hairColor: randomItem(HAIR_COLORS) };
    case "Rosto":
      return {
        ...f,
        eyebrows: randomItem(EYEBROWS).v,
        eyes:     randomItem(EYES).v,
        mouth:    randomItem(MOUTHS).v,
      };
    case "Barba":
      return { ...f, facialHair: randomItem(FACIAL_HAIR).v, facialHairColor: randomItem(HAIR_COLORS) };
    case "Roupa":
      return {
        ...f,
        clothing:        randomItem(CLOTHING).v,
        clothesColor:    randomItem(CLOTHES_COLORS),
        clothingGraphic: randomItem(CLOTHING_GRAPHIC).v,
      };
    case "Óculos":
      return { ...f, accessories: randomItem(ACCESSORIES).v, accessoriesColor: randomItem(CLOTHES_COLORS) };
    case "Fundo":
      return { ...f, backgroundColor: randomItem(BG_COLORS) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  figuraInicial: FiguraConfig | null;
  onClose: () => void;
}

export default function FiguraBuilder({ figuraInicial, onClose }: Props) {
  const router = useRouter();
  const [figura, setFigura] = useState<FiguraConfig>(figuraInicial ?? randomFigura());
  const [cat, setCat] = useState<Categoria>("Corpo");
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
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-4xl my-6 flex flex-col md:flex-row overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview grande — GeoGuessr coloca ele à esquerda e fixo enquanto o
            usuário mexe. Bom feedback visual + serve de "espelho". */}
        <div className="bg-gradient-to-br from-primary/15 via-black/70 to-black md:w-[42%] p-6 flex flex-col items-center justify-center gap-4 border-b md:border-b-0 md:border-r border-border">
          <div
            className="rounded-2xl p-2 shadow-inner"
            style={{
              background:
                figura.backgroundColor && figura.backgroundColor !== "#00000000"
                  ? figura.backgroundColor
                  : "rgba(255,255,255,0.05)",
            }}
          >
            <FiguraAvatar figura={figura} size={240} />
          </div>
          <div className="flex flex-col gap-2 w-full max-w-[220px]">
            <button
              onClick={() => setFigura(randomFigura())}
              className="flex items-center justify-center gap-2 text-xs bg-white/5 hover:bg-white/10 border border-border rounded-full px-3 py-2 text-white transition-colors"
            >
              <Shuffle size={12} /> Sortear tudo
            </button>
            <button
              onClick={() => setFigura((f) => randomizarCategoria(f, cat))}
              className="flex items-center justify-center gap-2 text-[11px] bg-transparent hover:bg-white/5 border border-border/60 rounded-full px-3 py-1.5 text-muted-foreground hover:text-white transition-colors"
            >
              <Shuffle size={11} /> Sortear {cat.toLowerCase()}
            </button>
          </div>
        </div>

        {/* Painel de controles */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h2 className="text-sm font-bold text-white">Monte seu personagem</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Cada opção mostra prévia com o seu boneco atual.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-white p-1"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Abas */}
          <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
            {CATEGORIAS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  cat === c ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Corpo de opções */}
          <div className="p-4 space-y-5 overflow-y-auto max-h-[50vh]">
            {cat === "Corpo" && (
              <Grupo label="Tom de pele">
                <SwatchRow
                  valores={SKIN_COLORS}
                  selecionado={figura.skinColor ? `#${figura.skinColor}` : undefined}
                  onSelect={(c) => set("skinColor", c.slice(1))}
                />
              </Grupo>
            )}

            {cat === "Cabelo" && (
              <>
                <Grupo label="Estilo">
                  <PreviewGrid
                    figura={figura}
                    campo="top"
                    valores={HAIR_STYLES}
                    onSelect={(v) => set("top", v)}
                  />
                </Grupo>
                <Grupo label="Cor do cabelo">
                  <SwatchRow
                    valores={HAIR_COLORS}
                    selecionado={figura.hairColor}
                    onSelect={(c) => set("hairColor", c)}
                  />
                </Grupo>
              </>
            )}

            {cat === "Rosto" && (
              <>
                <Grupo label="Sobrancelhas">
                  <PreviewGrid
                    figura={figura}
                    campo="eyebrows"
                    valores={EYEBROWS}
                    onSelect={(v) => set("eyebrows", v)}
                  />
                </Grupo>
                <Grupo label="Olhos">
                  <PreviewGrid
                    figura={figura}
                    campo="eyes"
                    valores={EYES}
                    onSelect={(v) => set("eyes", v)}
                  />
                </Grupo>
                <Grupo label="Boca">
                  <PreviewGrid
                    figura={figura}
                    campo="mouth"
                    valores={MOUTHS}
                    onSelect={(v) => set("mouth", v)}
                  />
                </Grupo>
              </>
            )}

            {cat === "Barba" && (
              <>
                <Grupo label="Estilo">
                  <PreviewGrid
                    figura={figura}
                    campo="facialHair"
                    valores={FACIAL_HAIR}
                    onSelect={(v) => set("facialHair", v)}
                  />
                </Grupo>
                <Grupo label="Cor da barba">
                  <SwatchRow
                    valores={HAIR_COLORS}
                    selecionado={figura.facialHairColor}
                    onSelect={(c) => set("facialHairColor", c)}
                  />
                </Grupo>
              </>
            )}

            {cat === "Roupa" && (
              <>
                <Grupo label="Tipo">
                  <PreviewGrid
                    figura={figura}
                    campo="clothing"
                    valores={CLOTHING}
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
                {figura.clothing === "graphicShirt" && (
                  <Grupo label="Estampa (só camiseta estampada)">
                    <PreviewGrid
                      figura={figura}
                      campo="clothingGraphic"
                      valores={CLOTHING_GRAPHIC}
                      onSelect={(v) => set("clothingGraphic", v)}
                    />
                  </Grupo>
                )}
              </>
            )}

            {cat === "Óculos" && (
              <>
                <Grupo label="Acessório">
                  <PreviewGrid
                    figura={figura}
                    campo="accessories"
                    valores={ACCESSORIES}
                    onSelect={(v) => set("accessories", v)}
                  />
                </Grupo>
                {figura.accessories && (
                  <Grupo label="Cor da armação">
                    <SwatchRow
                      valores={CLOTHES_COLORS}
                      selecionado={figura.accessoriesColor}
                      onSelect={(c) => set("accessoriesColor", c)}
                    />
                  </Grupo>
                )}
              </>
            )}

            {cat === "Fundo" && (
              <Grupo label="Cor de fundo">
                <BackgroundRow
                  valores={BG_COLORS}
                  selecionado={figura.backgroundColor}
                  onSelect={(c) => set("backgroundColor", c)}
                />
              </Grupo>
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

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────────────────────

function Grupo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function SwatchRow({
  valores, selecionado, onSelect,
}: { valores: string[]; selecionado?: string; onSelect: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {valores.map((c) => {
        const sel = selecionado?.toLowerCase() === c.toLowerCase() ||
                    selecionado?.toLowerCase() === c.slice(1).toLowerCase();
        return (
          <button
            key={c}
            onClick={() => onSelect(c)}
            className={`w-9 h-9 rounded-full border-2 transition-all ${
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

// Chips visuais estilo GeoGuessr: cada botão renderiza o personagem do usuário
// com apenas aquela opção sobrescrita. Custo: gerar N SVGs no client. Memoizo
// via React.memo com key baseada em (base-serializada + valor) — se o usuário
// só troca uma opção, apenas o chip alterado invalida.
function PreviewGrid({
  figura, campo, valores, onSelect,
}: {
  figura: FiguraConfig;
  campo: keyof FiguraConfig;
  valores: { v: string; l: string }[];
  onSelect: (v: string) => void;
}) {
  const selecionado = (figura[campo] as string | undefined) ?? "";
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
      {valores.map(({ v, l }) => (
        <PreviewChip
          key={v || "none"}
          figura={figura}
          campo={campo}
          valor={v}
          label={l}
          selecionado={selecionado === v}
          onClick={() => onSelect(v)}
        />
      ))}
    </div>
  );
}

const PreviewChip = memo(function PreviewChip({
  figura, campo, valor, label, selecionado, onClick,
}: {
  figura: FiguraConfig;
  campo: keyof FiguraConfig;
  valor: string;
  label: string;
  selecionado: boolean;
  onClick: () => void;
}) {
  // Aplica a opção candidata sobre o boneco atual do usuário.
  // Se `valor` é "" (opção "Sem barba", "Sem óculos"), remove o campo pra
  // DiceBear cair no default sem renderizar nada.
  const preview = useMemo<FiguraConfig>(() => {
    const next: FiguraConfig = { ...figura };
    if (valor) (next as Record<string, string>)[campo] = valor;
    else delete (next as Record<string, string | undefined>)[campo];
    return next;
  }, [figura, campo, valor]);

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all ${
        selecionado
          ? "border-primary bg-primary/10"
          : "border-border/40 bg-white/5 hover:border-white/40 hover:bg-white/10"
      }`}
    >
      <div className="w-14 h-14 overflow-hidden rounded-md bg-black/30 flex items-center justify-center">
        <FiguraAvatar figura={preview} size={56} />
      </div>
      <span className={`text-[9px] font-medium leading-tight text-center ${
        selecionado ? "text-primary" : "text-muted-foreground group-hover:text-white"
      }`}>
        {label}
      </span>
    </button>
  );
});

function BackgroundRow({
  valores, selecionado, onSelect,
}: { valores: string[]; selecionado?: string; onSelect: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {valores.map((c) => {
        const isTransp = c === "#00000000";
        const sel = (selecionado ?? "").toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            onClick={() => onSelect(c)}
            className={`w-11 h-11 rounded-lg border-2 transition-all overflow-hidden relative ${
              sel ? "border-primary scale-105" : "border-border hover:border-white/40"
            }`}
            style={{
              background: isTransp
                ? "repeating-conic-gradient(#4a4a4a 0% 25%, #2a2a2a 0% 50%) 50% / 10px 10px"
                : c,
            }}
            aria-label={isTransp ? "Sem fundo" : c}
          >
            {isTransp && (
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/70">
                sem
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
