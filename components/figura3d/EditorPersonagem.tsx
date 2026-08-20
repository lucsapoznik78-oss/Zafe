// O editor: o personagem é o palco, o resto é um painel ao lado.
//
// TRÊS COISAS ESTRUTURAIS
//
// 1. O canvas é o elemento dominante da página — ocupa a altura útil inteira no
//    desktop, e o cabeçalho (voltar, saldo) flutua POR CIMA dele em vez de
//    empurrá-lo para baixo. A página existe para olhar o boneco; qualquer
//    caixa própria que roube altura dele está roubando do motivo da visita.
//
// 2. A escolha é entre TRÊS coisas — montar o boneco, vestir acessório ou pegar
//    um personagem pronto do cast — e a barra que a oferece é uma linha de
//    texto sublinhado, não três retângulos. A versão original acertava a
//    divisão e errava o peso: botões do tamanho de um banner para uma escolha
//    que o usuário faz uma vez e esquece. Sublinhado ocupa a altura de uma
//    linha e ainda diz onde se está.
//
// 3. Clicar num item não comprado VESTE o item. É de graça, é reversível e é
//    muito melhor que miniatura: um canvas por card seriam 60 contextos WebGL
//    e o navegador corta em ~16. O card só vira "Comprar Z$ X" depois que a
//    pessoa viu a coisa no próprio boneco.
//
// O canvas mora fora das abas: se desmontasse na troca, o contexto WebGL seria
// recriado e a rotação escolhida evaporaria a cada ida e volta.

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
  AVATARES_POR_RARIDADE,
  AVATAR_POR_ID,
  precoAvatar,
  type AvatarCatalogo,
} from "@/lib/figura/avatares";
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

import { recorte, recorteAvatar } from "@/lib/figura/miniaturas";

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
 * A folha do cast é um ARQUIVO, não um canvas.
 *
 * As miniaturas dos 57 acessórios ainda são desenhadas na hora, e faz sentido:
 * o acessório é geometria gerada em código, então montar os 57 num canvas
 * escondido não baixa nada. O cast não é mais assim — cada um dos trinta é um
 * `.glb` de meio mega. Fotografá-los ao abrir a aba custaria ~16 MB baixados
 * para produzir uma imagem que é sempre exatamente a mesma.
 *
 * Renderizada no Blender (`scripts/blender/build_avatars.py -- --miniaturas`) e
 * versionada, ela chega em ~730 KB do cache, e a loja deixa de precisar de
 * WebGL para se mostrar. O `.glb` de um personagem só é baixado quando ele é
 * de fato escolhido.
 *
 * A grade é 5 colunas de célula retrato — o mesmo que `recorteAvatar` assume
 * para achar a célula. Os dois lados estão amarrados; ver `lib/figura/miniaturas.ts`.
 */
// O `?v` sobe junto com a folha. O nome do arquivo é fixo, então sem ele quem
// já abriu a loja continua vendo o elenco antigo — e a folha atual é a que tem
// os adereços; a anterior mostrava os mesmos trinta bonecos de mãos vazias.
const FOLHA_CAST = "/avatares/folha.png?v=2";

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

type Aba = "personagem" | "acessorios" | "avatares";

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
  const [aba, setAba] = useState<Aba>("personagem");
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

  /**
   * Escolhe um personagem pronto, ou desiste dele.
   *
   * Desistir não é "voltar ao boneco padrão": `equipado` e os traços continuam
   * no objeto o tempo todo, escondidos debaixo do avatar, e reaparecem
   * exatamente como estavam. Provar o cast tem que ser tão reversível quanto
   * provar um boné.
   */
  const escolherAvatar = useCallback((id: string) => {
    setFigura((f) => ({ ...f, avatar: f.avatar === id ? undefined : id }));
  }, []);

  const trocarAba = useCallback((a: Aba) => {
    setAba(a);
  }, []);

  /** Nomes do que está vestido e ainda não foi pago — o servidor descartaria. */
  const pendentes = useMemo(() => {
    // Com um personagem do cast escolhido, o boneco montado nem é desenhado:
    // avisar sobre um boné não pago que ninguém está vendo seria ruído.
    if (figura.avatar) {
      const av = AVATAR_POR_ID.get(figura.avatar);
      return av && !inventario.has(av.id) ? [av.nome] : [];
    }
    return Object.values(figura.equipado)
      .filter((id): id is string => !!id && !inventario.has(id))
      .map((id) => POR_ID.get(id)?.nome)
      .filter((n): n is string => !!n);
  }, [figura.avatar, figura.equipado, inventario]);

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
        texto: j.ja_possui
          ? "Você já tinha esse item."
          : `${POR_ID.get(itemId)?.nome ?? AVATAR_POR_ID.get(itemId)?.nome} é seu.`,
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
    <div className="mx-auto max-w-6xl px-3 pb-4 pt-3 sm:px-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(330px,1fr)]">
        {/* ================= o palco ================= */}
        <div className="relative lg:sticky lg:top-3 lg:self-start">
          {/* O palco é escuro FIXO, nos dois temas, e por isso não sai dos
              tokens: aqui a cor não é cromo de interface, é o fundo contra o
              qual a rim light desenha o contorno. Num fundo claro o fio de luz
              some — e ele é metade do que separa o personagem da tela. Não é
              preto absoluto pelo motivo oposto: #000 engole a silhueta e mata
              a própria sombra de contato. */}
          <div className="relative h-[48vh] min-h-[320px] overflow-hidden rounded-3xl border border-border bg-[radial-gradient(ellipse_65%_55%_at_50%_34%,#262C3C_0%,#171B25_52%,#0D1016_100%)] lg:h-[calc(100vh-8.5rem)]">
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

            {/* Claro fixo, não `text-muted-foreground`: o palco é escuro nos
                dois temas, então o token do tema claro sairia cinza sobre
                cinza-escuro. */}
            <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-white/45">
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
          <Abas atual={aba} onPick={trocarAba} />

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            {aba === "personagem" ? (
              <AbaCorpo figura={figura} mudar={mudar} coberto={Boolean(figura.avatar)} />
            ) : aba === "acessorios" ? (
              <AbaLoja
                figura={figura}
                inventario={inventario}
                ocupado={ocupado}
                folha={folha}
                alternar={alternar}
                comprar={comprar}
              />
            ) : (
              <AbaCast
                atual={figura.avatar}
                inventario={inventario}
                ocupado={ocupado}
                folha={FOLHA_CAST}
                escolher={escolherAvatar}
                comprar={comprar}
              />
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
                    ? `${pendentes[0]} ainda não é seu — compre para salvar.`
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

// ================================================================= ABAS
/**
 * Personagem | Acessórios | Avatares, em três palavras sublinhadas.
 *
 * Um trio de retângulos preenchidos ocuparia peso visual de botão primário para
 * uma decisão que a pessoa toma uma vez e não pensa mais nela, e disputaria
 * atenção com o "Salvar", que é o único botão de verdade da tela. Sublinhado
 * custa a altura de uma linha, mostra onde se está, e não parece um lugar para
 * clicar duas vezes.
 */
function Abas({ atual, onPick }: { atual: Aba; onPick: (a: Aba) => void }) {
  return (
    <div className="flex gap-5 border-b border-border">
      {(
        [
          ["personagem", "Personagem"],
          ["acessorios", "Acessórios"],
          ["avatares", "Avatares"],
        ] as const
      ).map(([id, rotulo]) => (
        <button
          key={id}
          onClick={() => onPick(id)}
          className={cn(
            "-mb-px border-b-2 pb-2 text-sm font-bold transition-colors",
            id === atual
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {rotulo}
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

function AbaCorpo({
  figura,
  mudar,
  coberto,
}: {
  figura: FiguraV2;
  mudar: (p: Partial<FiguraV2>) => void;
  /** Um avatar do cast está escolhido, então nada daqui aparece no canvas. */
  coberto: boolean;
}) {
  return (
    <div>
      {/* Sem este aviso, quem escolheu um avatar volta para cá, troca o cabelo,
          não vê nada mudar e conclui que a página quebrou. Os controles ficam
          ativos de propósito: o boneco continua salvo por baixo e o usuário
          pode arrumá-lo agora para achá-lo pronto quando tirar o avatar. */}
      {coberto && (
        <p className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Você está usando um personagem pronto. Estas escolhas continuam
          guardadas e voltam a aparecer quando você tirar o avatar.
        </p>
      )}
      <Secao titulo="Tom de pele">
        <Cores cores={PELES} atual={figura.pele} onPick={(pele) => mudar({ pele })} />
      </Secao>
      <Secao titulo="Físico">
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

function AbaLoja({
  figura,
  inventario,
  ocupado,
  folha,
  alternar,
  comprar,
}: {
  figura: FiguraV2;
  inventario: Set<string>;
  ocupado: string | null;
  folha: string | null;
  alternar: (slot: Slot, id: string) => void;
  comprar: (id: string) => void;
}) {
  return (
    <div>
      {figura.avatar && (
        <p className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          O personagem pronto vem com a roupa dele. Para voltar a usar acessórios,
          tire o avatar na aba Avatares.
        </p>
      )}
      {SLOTS.map((slot) => (
        <Secao key={slot} titulo={ROTULO_SLOT[slot]}>
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
        </Secao>
      ))}
    </div>
  );
}

// ============================================================== AVATARES
/**
 * O card do cast é RETRATO e maior que o de acessório: o que ele mostra é uma
 * pessoa de corpo inteiro, e num quadrado de 64px ela vira uma mancha. Duas
 * colunas, portanto — cabem menos por tela, e é o certo: o usuário escolhe um
 * personagem uma vez, não trinta.
 */
function CardAvatar({
  av,
  atual,
  meu,
  ocupado,
  folha,
  onEscolher,
  onComprar,
}: {
  av: AvatarCatalogo;
  atual: boolean;
  meu: boolean;
  ocupado: string | null;
  folha: string;
  onEscolher: () => void;
  onComprar: () => void;
}) {
  const mini = recorteAvatar(av.id, folha);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border transition-colors",
        atual ? "border-primary bg-primary/5" : "border-border bg-card",
      )}
    >
      <button onClick={onEscolher} className="text-left">
        <span
          className="relative flex aspect-[3/4] w-full items-center justify-center"
          style={{ ...mini, backgroundColor: `${COR_RARIDADE[av.raridade]}14` }}
        >
          {atual && (
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
          <span className="line-clamp-2 text-xs font-semibold leading-snug">{av.nome}</span>
          <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-muted-foreground">
            {av.descricao}
          </span>
        </span>
      </button>

      <div className="mt-auto p-2 pt-1.5">
        {meu ? (
          <span className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            {atual ? (
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
            {ocupado === av.id && <Loader2 size={11} className="animate-spin" />}
            {z$(precoAvatar(av))}
          </button>
        )}
      </div>
    </div>
  );
}

function AbaCast({
  atual,
  inventario,
  ocupado,
  folha,
  escolher,
  comprar,
}: {
  atual: string | undefined;
  inventario: Set<string>;
  ocupado: string | null;
  /** Sempre presente: a folha do cast é arquivo estático, não render em curso. */
  folha: string;
  escolher: (id: string) => void;
  comprar: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Personagens prontos. Clicar em um veste no canvas de graça — o boneco que
        você montou continua guardado e volta quando você tirar o avatar.
      </p>
      {AVATARES_POR_RARIDADE.map(([raridade, lista]) => (
        <Secao key={raridade} titulo={NOME_RARIDADE[raridade]}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {lista.map((av) => (
              <CardAvatar
                key={av.id}
                av={av}
                atual={atual === av.id}
                meu={inventario.has(av.id)}
                ocupado={ocupado}
                folha={folha}
                onEscolher={() => escolher(av.id)}
                onComprar={() => comprar(av.id)}
              />
            ))}
          </div>
        </Secao>
      ))}
    </div>
  );
}
