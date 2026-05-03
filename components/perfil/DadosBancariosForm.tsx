"use client";

import { useEffect, useState } from "react";

const TIPOS_PIX = [
  { value: "cpf",             label: "CPF" },
  { value: "email",           label: "E-mail" },
  { value: "celular",         label: "Celular" },
  { value: "chave_aleatoria", label: "Chave aleatória" },
];

function mascaraCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export default function DadosBancariosForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState("cpf");
  const [declaracao, setDeclaracao] = useState(false);
  const [declaracaoJaAceita, setDeclaracaoJaAceita] = useState(false);

  useEffect(() => {
    fetch("/api/perfil/dados-bancarios")
      .then((r) => r.json())
      .then(({ dados }) => {
        if (dados) {
          setNome(dados.nome_completo ?? "");
          setCpf(mascaraCPF(dados.cpf ?? ""));
          setPixKey(dados.pix_key ?? "");
          setPixType(dados.pix_key_type ?? "cpf");
          if (dados.declaracao_tributacao_aceita_em) {
            setDeclaracao(true);
            setDeclaracaoJaAceita(true);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro("");
    setSucesso(false);

    const res = await fetch("/api/perfil/dados-bancarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome_completo: nome,
        cpf,
        pix_key: pixKey,
        pix_key_type: pixType,
        aceita_declaracao: declaracao,
      }),
    });

    const json = await res.json();
    if (res.ok) {
      setSucesso(true);
      setDeclaracaoJaAceita(declaracao);
    } else {
      setErro(json.error ?? "Erro ao salvar.");
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="animate-pulse h-48 bg-card rounded-xl" />;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4">
        <p className="text-xs text-yellow-300/80 leading-relaxed">
          <span className="font-semibold text-yellow-400">Apenas para vencedores de concurso.</span>{" "}
          Estes dados são usados exclusivamente para transferir prêmios em R$ via PIX.
          Prêmios acima de R$ 1.903,98 sofrem retenção de 30% de IR na fonte (Lei 11.196/2005).
          A Zafe não usa estas informações para nenhuma outra finalidade.
        </p>
      </div>

      <form onSubmit={handleSalvar} className="space-y-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Nome completo</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como no documento oficial"
            required
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">CPF</label>
          <input
            type="text"
            value={cpf}
            onChange={(e) => setCpf(mascaraCPF(e.target.value))}
            placeholder="000.000.000-00"
            required
            inputMode="numeric"
            maxLength={14}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Tipo de chave PIX</label>
          <select
            value={pixType}
            onChange={(e) => setPixType(e.target.value)}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {TIPOS_PIX.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Chave PIX</label>
          <input
            type="text"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder={
              pixType === "cpf" ? "000.000.000-00" :
              pixType === "email" ? "seu@email.com" :
              pixType === "celular" ? "+55 11 99999-9999" :
              "Chave aleatória (32 caracteres)"
            }
            required
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-start gap-3 pt-1">
          <input
            type="checkbox"
            id="declaracao"
            checked={declaracao}
            onChange={(e) => setDeclaracao(e.target.checked)}
            disabled={declaracaoJaAceita}
            className="mt-0.5 accent-primary"
          />
          <label htmlFor="declaracao" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
            Declaro estar ciente de que prêmios em dinheiro recebidos através da Zafe estão sujeitos
            à tributação de Imposto de Renda conforme a legislação brasileira vigente, e que sou
            responsável pela declaração desses valores à Receita Federal.
          </label>
        </div>

        {erro && (
          <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{erro}</p>
        )}
        {sucesso && (
          <p className="text-xs text-green-400 bg-green-400/10 rounded-lg px-3 py-2">
            Dados salvos com sucesso!
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !declaracao}
          className="w-full py-2.5 rounded-lg bg-primary text-black text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Salvando..." : "Salvar dados bancários"}
        </button>
      </form>
    </div>
  );
}
