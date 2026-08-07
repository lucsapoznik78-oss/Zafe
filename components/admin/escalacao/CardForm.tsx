"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Regra {
  id: string;
  esporte_key: string;
  versao: number;
  ev_alvo: number | null;
}

interface Competicao {
  id: string;
  slug: string;
  nome: string;
}

interface Props {
  regras: Regra[];
  competicoes: Competicao[];
}

const HOJE = new Date();
const MES_PADRAO = `${HOJE.getFullYear()}-${String(HOJE.getMonth() + 1).padStart(2, "0")}-01`;

export default function CardForm({ regras, competicoes }: Props) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [modo, setModo] = useState<"mix" | "fixo">("mix");
  const [mes, setMes] = useState(MES_PADRAO);
  const [titulo, setTitulo] = useState("");
  const [competicaoId, setCompeticaoId] = useState("");
  const [nTitulares, setNTitulares] = useState(10);
  const [nReservas, setNReservas] = useState(2);
  const [entradaZ, setEntradaZ] = useState(200);
  const [pontosPorZ, setPontosPorZ] = useState(1.7);
  const [tetoEmissao, setTetoEmissao] = useState(0);
  const [abreEm, setAbreEm] = useState("");
  const [fechaEm, setFechaEm] = useState("");
  const [escolhidas, setEscolhidas] = useState<Record<string, string>>({});

  function alternarEsporte(regra: Regra) {
    setEscolhidas((atual) => {
      const copia = { ...atual };
      if (copia[regra.esporte_key] === regra.id) delete copia[regra.esporte_key];
      else copia[regra.esporte_key] = regra.id;
      return copia;
    });
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const res = await fetch("/api/admin/escalacao/card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modo,
        mes,
        titulo,
        competicao_id: modo === "fixo" ? competicaoId || null : null,
        n_titulares: nTitulares,
        n_reservas: nReservas,
        entrada_z: entradaZ,
        pontos_por_z: pontosPorZ,
        teto_emissao_z: tetoEmissao,
        abre_em: abreEm ? new Date(abreEm).toISOString() : "",
        fecha_em: fechaEm ? new Date(fechaEm).toISOString() : "",
        esportes: Object.entries(escolhidas).map(([esporte_key, regra_id]) => ({
          esporte_key,
          regra_id,
        })),
      }),
    });
    const json = await res.json();
    setSalvando(false);
    if (!res.ok) {
      setErro(json.error ?? "Falha ao criar o card");
      return;
    }
    router.push(`/admin/escalacao/${json.id}`);
  }

  const campo = "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-white";
  const rotulo = "text-xs text-muted-foreground";

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white">Nova Convocação</h3>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className={rotulo}>Modo</span>
          <select value={modo} onChange={(e) => setModo(e.target.value as "mix" | "fixo")} className={campo}>
            <option value="mix">Mix (um card por mês)</option>
            <option value="fixo">Fixo (uma liga)</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className={rotulo}>Mês (1º dia)</span>
          <input type="date" value={mes} onChange={(e) => setMes(e.target.value)} className={campo} />
        </label>
      </div>

      <label className="space-y-1 block">
        <span className={rotulo}>Título</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={campo}
          placeholder="Convocação de setembro" />
      </label>

      {modo === "fixo" && (
        <label className="space-y-1 block">
          <span className={rotulo}>Competição</span>
          <select value={competicaoId} onChange={(e) => setCompeticaoId(e.target.value)} className={campo}>
            <option value="">Selecionar…</option>
            {competicoes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className={rotulo}>Titulares</span>
          <input type="number" value={nTitulares} onChange={(e) => setNTitulares(Number(e.target.value))} className={campo} />
        </label>
        <label className="space-y-1">
          <span className={rotulo}>Reservas</span>
          <input type="number" value={nReservas} onChange={(e) => setNReservas(Number(e.target.value))} className={campo} />
        </label>
        <label className="space-y-1">
          <span className={rotulo}>Entrada (Z$)</span>
          <input type="number" value={entradaZ} onChange={(e) => setEntradaZ(Number(e.target.value))} className={campo} />
        </label>
        <label className="space-y-1">
          <span className={rotulo}>Pontos por 1 Z$</span>
          <input type="number" step="0.1" value={pontosPorZ} onChange={(e) => setPontosPorZ(Number(e.target.value))} className={campo} />
        </label>
      </div>

      <label className="space-y-1 block">
        <span className={rotulo}>Teto de emissão de Z$ (disjuntor)</span>
        <input type="number" value={tetoEmissao} onChange={(e) => setTetoEmissao(Number(e.target.value))} className={campo} />
        <span className="text-[11px] text-muted-foreground">
          Se o total a pagar passar deste valor, o pagamento é recusado por inteiro. Use ~3× a
          emissão esperada.
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className={rotulo}>Abre em</span>
          <input type="datetime-local" value={abreEm} onChange={(e) => setAbreEm(e.target.value)} className={campo} />
        </label>
        <label className="space-y-1">
          <span className={rotulo}>Fecha em</span>
          <input type="datetime-local" value={fechaEm} onChange={(e) => setFechaEm(e.target.value)} className={campo} />
        </label>
      </div>

      <div className="space-y-2">
        <span className={rotulo}>Esportes e versão do manual</span>
        <div className="flex flex-wrap gap-2">
          {regras.map((r) => {
            const ativa = escolhidas[r.esporte_key] === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => alternarEsporte(r)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  ativa
                    ? "bg-primary text-white border-primary"
                    : "bg-muted text-muted-foreground border-border hover:text-white"
                }`}
              >
                {r.esporte_key}.v{r.versao}
              </button>
            );
          })}
        </div>
      </div>

      {erro && <p className="text-xs text-nao">{erro}</p>}

      <button
        onClick={salvar}
        disabled={salvando || !titulo || Object.keys(escolhidas).length === 0}
        className="w-full py-2 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {salvando ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Criar em rascunho"}
      </button>
    </div>
  );
}
