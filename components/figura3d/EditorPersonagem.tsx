// O editor: o personagem é o palco, o resto é um painel ao lado.
//
// TRÊS COISAS ESTRUTURAIS
//
// 1. O canvas é o elemento dominante da página — ocupa a altura útil inteira no
//    desktop, e o cabeçalho (voltar, saldo) flutua POR CIMA dele em vez de
//    empurrá-lo para baixo. A página existe para olhar o boneco; qualquer
//    caixa própria que roube altura dele está roubando do motivo da visita.
//
// 2. Não há abas. A versão anterior gastava uma faixa inteira num par
//    PERSONAGEM/ACESSÓRIOS — dois botões gigantes para uma escolha binária que
//    ainda escondia um segundo nível de navegação (rolar até a seção certa
//    entre dez). Agora é uma única trilha horizontal com as 13 categorias
//    reais (corpo, cabelo, feições + os 10 slots): mesma altura de uma linha,
//    e um clique leva direto ao que se quer trocar, sem rolagem cega.
//
// 3. Clicar num item não comprado VESTE o item. É de graça, é reversível e é
//    muito melhor que miniatura: um canvas por card seriam 60 contextos WebGL
//    e o navegador corta em ~16. O card só vira "Comprar Z$ X" depois que a
//    pessoa viu a coisa no próprio boneco.
//
// O canvas mora fora do painel de categorias: se desmontasse na troca, o
// contexto WebGL seria recriado e a rotação escolhida evaporaria a cada clique.

"use client";

import {
  Backpack,
  Bike,
  Car,
  Check,
  Crown,
  Cylinder,
  EyeOff,
  Feather,
  Fish,
  Flame,
  Flashlight,
  Flower,
  Footprints,
  Gavel,
  Glasses,
  GraduationCap,
  HardHat,
  Loader2,
  Lock,
  Mic,
  ScanLine,
  Shield,
  Shirt,
  Skull,
  Smartphone,
  Snowflake,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Truck,
  VenetianMask,
  Volleyball,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  ITENS_POR_SLOT,
  POR_ID,
  ROTULO_SLOT,
  precoDe,
  type ItemCatalogo,
} from "@/lib/figura/catalogo";
import {
  BARBAS,
  BOCAS,
  CABELOS,
  CABELO_ESTILOS,
  COR_RARIDADE,
  CORPOS,
  NOME_RARIDADE,
  OLHOS,
  PELES,
  SOBRANCELHAS,
} from "@/lib/figura/paletas";
import { PRECO_DESBLOQUEIO, SLOTS, type FiguraV2, type Slot } from "@/lib/figura/tipos";
import { cn } from "@/lib/utils";

import { recorte } from "@/lib/figura/miniaturas";

import type { Alca } from "./PersonagemCanvas";
import { temWebGL } from "./captura";

// `ssr: false` é obrigatório, não otimização: o three toca `window` no import.
// E é isto que mantém o bundle do WebGL preso a esta rota — a navbar aparece em
// todas as outras, e um import estático arrastaria three para todas elas.
const PersonagemCanvas = dynamic(
  () => import("./PersonagemCanvas").then((m) => m.PersonagemCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

// Descartável: monta uma vez, entrega o PNG das miniaturas e é desmontado.
const AtlasMiniaturas = dynamic(() => import("./Miniaturas").then((m) => m.AtlasMiniaturas), {
  ssr: false,
});

/**
 * Só os ícones usados (`import * as Icons` traria as ~1500 do lucide junto).
 *
 * O ícone é o ESPAÇO RESERVADO: aparece enquanto a folha de miniaturas 3D não
 * ficou pronta, e some quando ela chega. Sem ele o card pisca vazio no primeiro
 * segundo e a loja parece quebrada.
 */
const ICONES: Record<string, LucideIcon> = {
  Backpack, Bike, Car, Crown, Cylinder, EyeOff, Feather, Fish, Flame, Flashlight,
  Flower, Footprints, Gavel, Glasses, GraduationCap, HardHat, Mic, ScanLine, Shield,
  Shirt, Skull, Smartphone, Snowflake, Sparkles, Swords, Trophy, Truck, VenetianMask,
  Volleyball, Waves, Wind, Zap,
};

const z$ = (n: number) => `Z$ ${n.toLocaleString("pt-BR")}`;

/**
 * A trilha de categorias — o que substituiu as abas.
 *
 * Corpo e loja são o MESMO nível de navegação aqui, e não dois mundos: do ponto
 * de vista de quem monta o boneco, "trocar o cabelo" e "trocar o boné" são a
 * mesma ação. Separá-los em abas obrigava a lembrar em qual metade estava cada
 * coisa antes de poder procurar. Numa trilha só, a ordem é a do corpo — da
 * cabeça aos pés, depois o que se carrega, e o veículo por último.
 */
type Categoria = { id: string; rotulo: string; slot?: Slot };

const CATEGORIAS: readonly Categoria[] = [
  { id: "corpo", rotulo: "Corpo" },
  { id: "cabelo", rotulo: "Cabelo" },
  { id: "feicoes", rotulo: "Feições" },
  ...SLOTS.map((slot) => ({ id: slot, rotulo: ROTULO_SLOT[slot], slot })),
];

type Props = {
  figuraInicial: FiguraV2;
  desbloqueada: boolean;
  saldoInicial: number;
  inventarioInicial: string[];
  /** Posição no ranking geral — estampada na roupa, não editável. */
  posicao: number | null;
};

export default function EditorPersonagem({
  figuraInicial,
  desbloqueada: desbloqueadaInicial,
  saldoInicial,
  inventarioInicial,
  posicao,
}: Props) {
  const [figura, setFigura] = useState<FiguraV2>(figuraInicial);
  const [inventario, setInventario] = useState(() => new Set(inventarioInicial));
  const [saldo, setSaldo] = useState(saldoInicial);
  const [desbloqueada, setDesbloqueada] = useState(desbloqueadaInicial);
  const [categoria, setCategoria] = useState<string>("corpo");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const canvas = useRef<Alca>(null);
  // Sonda uma vez só. Sem WebGL não há editor — nem canvas para montar.
  const [webgl] = useState(temWebGL);
  // A folha de miniaturas. Enquanto for null, o card mostra o ícone lucide.
  const [folha, setFolha] = useState<string | null>(null);

  const mudar = useCallback((patch: Partial<FiguraV2>) => {
    setFigura((f) => ({ ...f, ...patch }));
  }, []);

  /** Veste ou tira. Item não comprado veste igual — a cobrança é no botão. */
  const alternar = useCallback((slot: Slot, id: string) => {
    setFigura((f) => {
      const equipado = { ...f.equipado };
      if (equipado[slot] === id) delete equipado[slot];
      else equipado[slot] = id;
      // Duas mãos é a única exclusão do modelo, e o servidor reaplica ao salvar.
      const dir = equipado.maoDir;
      if (dir && POR_ID.get(dir)?.duasMaos) delete equipado.maoEsq;
      return { ...f, equipado };
    });
  }, []);

  /** Itens vestidos que ainda não foram pagos — o servidor descartaria. */
  const pendentes = useMemo(
    () =>
      Object.values(figura.equipado)
        .filter((id): id is string => !!id && !inventario.has(id))
        .map((id) => POR_ID.get(id)!)
        .filter(Boolean),
    [figura.equipado, inventario],
  );

  async function desbloquear() {
    setOcupado("desbloquear");
    setAviso(null);
    try {
      const r = await fetch("/api/perfil/figura/desbloquear", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Não foi possível desbloquear");
      setDesbloqueada(true);
      setSaldo((s) => s - (j.cobrado ?? 0));
      setInventario((inv) => new Set([...inv, ...(j.iniciais ?? [])]));
      setAviso({ tipo: "ok", texto: "Editor liberado. Bom proveito." });
    } catch (e) {
      setAviso({ tipo: "erro", texto: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  }

  async function comprar(itemId: string) {
    setOcupado(itemId);
    setAviso(null);
    try {
      const r = await fetch("/api/perfil/figura/comprar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Não foi possível comprar");
      setInventario((inv) => new Set(inv).add(itemId));
      setSaldo((s) => s - (j.cobrado ?? 0));
      setAviso({
        tipo: "ok",
        texto: j.ja_possui ? "Você já tinha esse item." : `${POR_ID.get(itemId)?.nome} é seu.`,
      });
    } catch (e) {
      setAviso({ tipo: "erro", texto: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  }

  async function salvar() {
    setOcupado("salvar");
    setAviso(null);
    try {
      const fotos = await canvas.current?.capturar();
      if (!fotos) throw new Error("O personagem ainda está carregando");

      const fd = new FormData();
      fd.append("figura", JSON.stringify(figura));
      fd.append("retrato", fotos.retrato, "retrato.png");
      fd.append("corpo", fotos.corpo, "corpo.png");

      const r = await fetch("/api/perfil/figura", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Não foi possível salvar");

      // O servidor pode ter descartado item (aba velha, item não comprado). A
      // figura que volta é a verdade — adotar a nossa deixaria a tela mentindo.
      setFigura(j.figura);
      setAviso({ tipo: "ok", texto: "Personagem salvo." });
    } catch (e) {
      setAviso({ tipo: "erro", texto: (e as Error).message });
    } finally {
      setOcupado(null);
    }
  }

  if (!webgl) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-bold">Seu navegador não abre o editor 3D</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O personagem precisa de WebGL, que costuma vir desligado nos navegadores dentro do
          Instagram e do WhatsApp. Abra o zafe.app.br no Chrome ou no Safari do celular.
        </p>
        <Link href="/perfil" className="mt-6 inline-block text-sm font-semibold text-primary">
          Voltar ao perfil
        </Link>
      </div>
    );
  }

  const atual = CATEGORIAS.find((c) => c.id === categoria) ?? CATEGORIAS[0];

  return (
    <div className="mx-auto max-w-6xl px-3 pb-4 pt-3 sm:px-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(330px,1fr)]">
        {/* ================= o palco ================= */}
        <div className="relative lg:sticky lg:top-3 lg:self-start">
          <div className="relative h-[48vh] min-h-[320px] overflow-hidden rounded-3xl border border-border bg-[radial-gradient(120%_90%_at_50%_0%,hsl(var(--muted))_0%,hsl(var(--background))_70%)] lg:h-[calc(100vh-8.5rem)]">
            <PersonagemCanvas ref={canvas} figura={figura} posicao={posicao} />

            {/* Sobre o canvas, não acima dele: cabeçalho não rouba altura do boneco. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-3">
              <Link
                href="/perfil"
                className="pointer-events-auto rounded-full bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm hover:text-foreground"
              >
                ← Perfil
              </Link>
              <span className="rounded-full bg-background/70 px-3 py-1.5 text-xs font-bold tabular-nums backdrop-blur-sm">
                {z$(saldo)}
              </span>
            </div>

            <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-muted-foreground">
              Arraste para girar
            </p>
          </div>

          {!desbloqueada && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-background/85 p-6 text-center backdrop-blur-sm">
              <Sparkles className="size-7 text-primary" />
              <div>
                <p className="font-bold">Crie seu personagem</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {z$(PRECO_DESBLOQUEIO)} uma vez. Depois é seu para sempre, e editar é de graça.
                </p>
              </div>
              <button
                onClick={desbloquear}
                disabled={ocupado !== null}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50"
              >
                {ocupado === "desbloquear" ? "Liberando…" : `Liberar por ${z$(PRECO_DESBLOQUEIO)}`}
              </button>
            </div>
          )}
        </div>

        {/* ================= o painel ================= */}
        <div
          className={cn(
            "flex flex-col gap-3 lg:sticky lg:top-3 lg:h-[calc(100vh-8.5rem)]",
            !desbloqueada && "pointer-events-none select-none opacity-40",
          )}
        >
          <Trilha
            atual={atual.id}
            equipado={figura.equipado}
            onPick={setCategoria}
          />

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            {atual.slot ? (
              <Prateleira
                slot={atual.slot}
                figura={figura}
                inventario={inventario}
                ocupado={ocupado}
                folha={folha}
                alternar={alternar}
                comprar={comprar}
              />
            ) : (
              <PainelCorpo id={atual.id} figura={figura} mudar={mudar} />
            )}
          </div>

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <div className="min-w-0 flex-1 text-sm">
              {aviso ? (
                <span className={aviso.tipo === "ok" ? "text-emerald-500" : "text-destructive"}>
                  {aviso.texto}
                </span>
              ) : pendentes.length > 0 ? (
                <span className="text-muted-foreground">
                  {pendentes.length === 1
                    ? `${pendentes[0].nome} ainda não é seu — compre para salvar.`
                    : `${pendentes.length} itens vestidos ainda não são seus.`}
                </span>
              ) : (
                <span className="text-muted-foreground">Gire, escolha e salve.</span>
              )}
            </div>
            <button
              onClick={salvar}
              disabled={!desbloqueada || ocupado !== null}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50"
            >
              {ocupado === "salvar" ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </div>

      {/* Desenha os 57 itens uma vez e some. Ver o cabeçalho de Miniaturas.tsx. */}
      {folha === null && <AtlasMiniaturas aoGerar={setFolha} />}
    </div>
  );
}

// =============================================================== TRILHA
/**
 * A lista de categorias, numa linha que rola de lado.
 *
 * O ponto ao lado do rótulo é o que as abas davam de graça e a trilha teria
 * perdido: com só uma categoria visível por vez, não haveria como saber que há
 * um item equipado em "Costas" sem visitar "Costas". O ponto devolve o
 * inventário vestido inteiro à primeira olhada.
 */
function Trilha({
  atual,
  equipado,
  onPick,
}: {
  atual: string;
  equipado: FiguraV2["equipado"];
  onPick: (id: string) => void;
}) {
  return (
    <div className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      {CATEGORIAS.map((c) => (
        <button
          key={c.id}
          onClick={() => onPick(c.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            c.id === atual
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {c.rotulo}
          {c.slot && equipado[c.slot] && <span className="size-1.5 rounded-full bg-primary" />}
        </button>
      ))}
    </div>
  );
}

// ========================================================== CORPO
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Chips<T extends string | number>({
  opcoes,
  atual,
  onPick,
}: {
  opcoes: ReadonlyArray<{ id: T; nome: string }>;
  atual: T;
  onPick: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => (
        <button
          key={o.id}
          onClick={() => onPick(o.id)}
          className={cn(
            "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
            o.id === atual
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {o.nome}
        </button>
      ))}
    </div>
  );
}

function Cores({
  cores,
  atual,
  onPick,
}: {
  cores: readonly string[];
  atual: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {cores.map((cor, i) => (
        <button
          key={cor}
          onClick={() => onPick(i)}
          aria-label={`Cor ${i + 1}`}
          style={{ backgroundColor: cor }}
          className={cn(
            "size-7 rounded-full border-2 transition-transform",
            i === atual ? "scale-110 border-foreground" : "border-transparent hover:scale-105",
          )}
        />
      ))}
    </div>
  );
}

function PainelCorpo({
  id,
  figura,
  mudar,
}: {
  id: string;
  figura: FiguraV2;
  mudar: (p: Partial<FiguraV2>) => void;
}) {
  if (id === "cabelo") {
    return (
      <Secao titulo="Cabelo">
        <Chips
          opcoes={CABELO_ESTILOS}
          atual={figura.cabelo}
          onPick={(cabelo) => mudar({ cabelo })}
        />
        <div className="mt-2">
          <Cores cores={CABELOS} atual={figura.cabeloCor} onPick={(c) => mudar({ cabeloCor: c })} />
        </div>
      </Secao>
    );
  }

  if (id === "feicoes") {
    return (
      <div>
        <Secao titulo="Olhos">
          <Chips opcoes={OLHOS} atual={figura.olhos} onPick={(olhos) => mudar({ olhos })} />
        </Secao>
        <Secao titulo="Sobrancelha">
          <Chips
            opcoes={SOBRANCELHAS}
            atual={figura.sobrancelha}
            onPick={(sobrancelha) => mudar({ sobrancelha })}
          />
        </Secao>
        <Secao titulo="Boca">
          <Chips opcoes={BOCAS} atual={figura.boca} onPick={(boca) => mudar({ boca })} />
        </Secao>
        <Secao titulo="Barba">
          <Chips opcoes={BARBAS} atual={figura.barba} onPick={(barba) => mudar({ barba })} />
          {figura.barba !== "nenhuma" && (
            <div className="mt-2">
              <Cores
                cores={CABELOS}
                atual={figura.barbaCor}
                onPick={(c) => mudar({ barbaCor: c })}
              />
            </div>
          )}
        </Secao>
      </div>
    );
  }

  return (
    <div>
      <Secao titulo="Tom de pele">
        <Cores cores={PELES} atual={figura.pele} onPick={(pele) => mudar({ pele })} />
      </Secao>
      <Secao titulo="Físico">
        <Chips opcoes={CORPOS} atual={figura.corpo} onPick={(corpo) => mudar({ corpo })} />
      </Secao>
    </div>
  );
}

// ========================================================== ACESSÓRIOS
/**
 * O card é VERTICAL: miniatura em cima, nome embaixo em até duas linhas.
 *
 * A versão anterior era horizontal (ícone à esquerda, nome à direita) e o nome
 * ficava com ~70px numa coluna de grade — "Bucket camuflado" virava "B…". Em
 * pilha, o nome recebe a largura inteira do card, e `line-clamp-2` só corta o
 * que realmente não cabe em duas linhas.
 */
function Card({
  it,
  vestido,
  meu,
  ocupado,
  folha,
  onVestir,
  onComprar,
}: {
  it: ItemCatalogo;
  vestido: boolean;
  meu: boolean;
  ocupado: string | null;
  folha: string | null;
  onVestir: () => void;
  onComprar: () => void;
}) {
  const Icone = ICONES[it.icone] ?? Sparkles;
  const mini = folha ? recorte(it.id, folha) : undefined;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border transition-colors",
        vestido ? "border-primary bg-primary/5" : "border-border bg-card",
      )}
    >
      <button onClick={onVestir} className="group text-left">
        <span
          className="relative flex aspect-square w-full items-center justify-center"
          style={{
            ...mini,
            backgroundColor: `${COR_RARIDADE[it.raridade]}14`,
          }}
        >
          {!mini && <Icone size={22} style={{ color: COR_RARIDADE[it.raridade] }} />}
          {vestido && (
            <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
              <Check size={11} />
            </span>
          )}
          {!meu && (
            <span className="absolute left-1 top-1 rounded-full bg-background/80 p-1 text-muted-foreground">
              <Lock size={10} />
            </span>
          )}
        </span>
        <span className="block px-2 pt-1.5">
          <span className="line-clamp-2 text-xs font-semibold leading-snug">{it.nome}</span>
          <span
            className="mt-0.5 block text-[10px] font-medium"
            style={{ color: COR_RARIDADE[it.raridade] }}
          >
            {NOME_RARIDADE[it.raridade]}
          </span>
        </span>
      </button>

      <div className="mt-auto p-2 pt-1.5">
        {meu ? (
          <span className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            {vestido ? (
              <>
                <Trash2 size={10} /> Tirar
              </>
            ) : (
              "Seu"
            )}
          </span>
        ) : (
          <button
            onClick={onComprar}
            disabled={ocupado !== null}
            className="flex w-full items-center justify-center gap-1 rounded-md bg-foreground/90 px-2 py-1 text-[11px] font-bold text-background hover:bg-foreground disabled:opacity-50"
          >
            {ocupado === it.id && <Loader2 size={11} className="animate-spin" />}
            {z$(precoDe(it))}
          </button>
        )}
      </div>
    </div>
  );
}

/** Os itens de um slot só — a trilha já disse qual. */
function Prateleira({
  slot,
  figura,
  inventario,
  ocupado,
  folha,
  alternar,
  comprar,
}: {
  slot: Slot;
  figura: FiguraV2;
  inventario: Set<string>;
  ocupado: string | null;
  folha: string | null;
  alternar: (slot: Slot, id: string) => void;
  comprar: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {(ITENS_POR_SLOT[slot] ?? []).map((it) => (
        <Card
          key={it.id}
          it={it}
          vestido={figura.equipado[slot] === it.id}
          meu={inventario.has(it.id)}
          ocupado={ocupado}
          folha={folha}
          onVestir={() => alternar(slot, it.id)}
          onComprar={() => comprar(it.id)}
        />
      ))}
    </div>
  );
}
