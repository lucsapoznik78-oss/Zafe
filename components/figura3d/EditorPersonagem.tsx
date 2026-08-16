// O editor: canvas à esquerda, abas à direita, salvar embaixo.
//
// DUAS COISAS ESTRUTURAIS
//
// 1. O canvas mora FORA do conteúdo das abas. Se ele estivesse dentro de
//    <TabsContent>, trocar de aba desmontaria o componente, o contexto WebGL
//    seria recriado do zero e a rotação que o usuário escolheu evaporaria a
//    cada ida e volta entre "personagem" e "acessórios".
//
// 2. Clicar num item não comprado VESTE o item. É de graça, é reversível e é
//    muito melhor que miniatura: um canvas por card seriam 60 contextos WebGL
//    e o navegador corta em ~16. O card só vira "Comprar Z$ X" depois que a
//    pessoa viu a coisa no próprio boneco.

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
  HardHat,
  Loader2,
  Lock,
  Mic,
  ScanLine,
  Shield,
  Shirt,
  Skull,
  Smartphone,
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

import { ITENS_POR_SLOT, POR_ID, ROTULO_SLOT, precoDe } from "@/lib/figura/catalogo";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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

/** Só os ícones usados. `import * as Icons` traria as ~1500 do lucide junto. */
const ICONES: Record<string, LucideIcon> = {
  Backpack, Bike, Car, Crown, Cylinder, EyeOff, Feather, Fish, Flame, Flashlight,
  Flower, Footprints, Gavel, Glasses, HardHat, Mic, ScanLine, Shield, Shirt, Skull,
  Smartphone, Sparkles, Swords, Trophy, Truck, VenetianMask, Volleyball, Waves, Wind, Zap,
};

const z$ = (n: number) => `Z$ ${n.toLocaleString("pt-BR")}`;

type Props = {
  figuraInicial: FiguraV2;
  desbloqueada: boolean;
  saldoInicial: number;
  inventarioInicial: string[];
};

export default function EditorPersonagem({
  figuraInicial,
  desbloqueada: desbloqueadaInicial,
  saldoInicial,
  inventarioInicial,
}: Props) {
  const [figura, setFigura] = useState<FiguraV2>(figuraInicial);
  const [inventario, setInventario] = useState(() => new Set(inventarioInicial));
  const [saldo, setSaldo] = useState(saldoInicial);
  const [desbloqueada, setDesbloqueada] = useState(desbloqueadaInicial);
  const [aba, setAba] = useState("personagem");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const canvas = useRef<Alca>(null);
  // Sonda uma vez só. Sem WebGL não há editor — nem canvas para montar.
  const [webgl] = useState(temWebGL);

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

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <Link href="/perfil" className="text-sm text-muted-foreground hover:text-foreground">
          ← Perfil
        </Link>
        <h1 className="text-base font-bold">Personagem</h1>
        <span className="rounded-lg bg-muted px-2.5 py-1 text-sm font-semibold tabular-nums">
          {z$(saldo)}
        </span>
      </header>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* ---- canvas: fora das abas, de propósito ---- */}
        <div className="relative md:sticky md:top-4 md:self-start">
          <div className="h-[42vh] min-h-[280px] overflow-hidden rounded-xl border border-border bg-gradient-to-b from-muted/60 to-background md:h-[62vh]">
            <PersonagemCanvas ref={canvas} figura={figura} />
          </div>
          {!desbloqueada && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/85 p-6 text-center backdrop-blur-sm">
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
          <p className="mt-1.5 text-center text-xs text-muted-foreground">
            Arraste para girar
          </p>
        </div>

        {/* ---- painéis ---- */}
        <div className={cn(!desbloqueada && "pointer-events-none select-none opacity-40")}>
          <Tabs value={aba} onValueChange={(v) => setAba(v as string)}>
            <TabsList className="w-full">
              <TabsTrigger value="personagem">PERSONAGEM</TabsTrigger>
              <TabsTrigger value="acessorios">ACESSÓRIOS</TabsTrigger>
            </TabsList>

            <div className="mt-3 max-h-[46vh] overflow-y-auto overscroll-contain pr-1 md:max-h-[56vh]">
              <TabsContent value="personagem">
                <AbaCorpo figura={figura} mudar={mudar} />
              </TabsContent>
              <TabsContent value="acessorios">
                <AbaLoja
                  figura={figura}
                  inventario={inventario}
                  ocupado={ocupado}
                  alternar={alternar}
                  comprar={comprar}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* ---- barra de baixo ---- */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
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
          {ocupado === "salvar" ? "Salvando…" : "Salvar personagem"}
        </button>
      </div>
    </div>
  );
}

// ======================================================== ABA PERSONAGEM
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

function AbaCorpo({
  figura,
  mudar,
}: {
  figura: FiguraV2;
  mudar: (p: Partial<FiguraV2>) => void;
}) {
  return (
    <div>
      <Secao titulo="Tom de pele">
        <Cores cores={PELES} atual={figura.pele} onPick={(pele) => mudar({ pele })} />
      </Secao>
      <Secao titulo="Corpo">
        <Chips opcoes={CORPOS} atual={figura.corpo} onPick={(corpo) => mudar({ corpo })} />
      </Secao>
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
            <Cores cores={CABELOS} atual={figura.barbaCor} onPick={(c) => mudar({ barbaCor: c })} />
          </div>
        )}
      </Secao>
    </div>
  );
}

// ========================================================== ABA ACESSÓRIOS
function AbaLoja({
  figura,
  inventario,
  ocupado,
  alternar,
  comprar,
}: {
  figura: FiguraV2;
  inventario: Set<string>;
  ocupado: string | null;
  alternar: (slot: Slot, id: string) => void;
  comprar: (id: string) => void;
}) {
  return (
    <div>
      {SLOTS.map((slot) => (
        <Secao key={slot} titulo={ROTULO_SLOT[slot]}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(ITENS_POR_SLOT[slot] ?? []).map((it) => {
              const Icone = ICONES[it.icone] ?? Sparkles;
              const vestido = figura.equipado[slot] === it.id;
              const meu = inventario.has(it.id);
              const preco = precoDe(it);
              return (
                <div
                  key={it.id}
                  className={cn(
                    "rounded-lg border p-2 transition-colors",
                    vestido ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <button
                    onClick={() => alternar(slot, it.id)}
                    className="flex w-full items-start gap-2 text-left"
                  >
                    <span
                      className="mt-0.5 rounded-md p-1.5"
                      style={{ backgroundColor: `${COR_RARIDADE[it.raridade]}22` }}
                    >
                      <Icone size={16} style={{ color: COR_RARIDADE[it.raridade] }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{it.nome}</span>
                      <span
                        className="block text-[10px] font-medium"
                        style={{ color: COR_RARIDADE[it.raridade] }}
                      >
                        {NOME_RARIDADE[it.raridade]}
                      </span>
                    </span>
                    {vestido && <Check size={14} className="mt-0.5 shrink-0 text-primary" />}
                  </button>

                  <div className="mt-1.5">
                    {meu ? (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {vestido ? (
                          <>
                            <Trash2 size={10} /> Toque para tirar
                          </>
                        ) : (
                          "Seu"
                        )}
                      </span>
                    ) : (
                      <button
                        onClick={() => comprar(it.id)}
                        disabled={ocupado !== null}
                        className="flex w-full items-center justify-center gap-1 rounded-md bg-foreground/90 px-2 py-1 text-[11px] font-bold text-background hover:bg-foreground disabled:opacity-50"
                      >
                        {ocupado === it.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Lock size={10} />
                        )}
                        {z$(preco)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Secao>
      ))}
    </div>
  );
}
