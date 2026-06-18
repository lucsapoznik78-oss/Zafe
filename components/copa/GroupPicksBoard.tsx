"use client";

import { useState } from "react";
import { Check, Loader2, Lock, Shuffle } from "lucide-react";

// Matriz de palpites de classificação: para cada grupo, o usuário marca
// quem termina em 1º, 2º e 3º (estilo cartela de bolão). Linhas ganham a
// cor da posição escolhida. "Sorteio aleatório" preenche o grupo.

interface GroupData {
  name: string;
  teams: string[];
  lockAt: string;
}

interface PickValue {
  first_team: string;
  second_team: string;
  third_team: string;
}

interface Props {
  groups: GroupData[];
  initialPicks: Record<string, PickValue>;
  isParticipant: boolean;
}

type Slots = { [pos: number]: string | undefined };

const POS_STYLES: Record<number, string> = {
  1: "bg-violet-600 text-white",
  2: "bg-rose-600 text-white",
  3: "bg-green-500 text-black",
};

function toSlots(pick: PickValue | undefined): Slots {
  if (!pick) return {};
  return { 1: pick.first_team, 2: pick.second_team, 3: pick.third_team };
}

export default function GroupPicksBoard({ groups, initialPicks, isParticipant }: Props) {
  const [slots, setSlots] = useState<Record<string, Slots>>(() =>
    Object.fromEntries(groups.map((g) => [g.name, toSlots(initialPicks[g.name])]))
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.name, !!initialPicks[g.name]]))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setPick = (group: string, team: string, pos: number) => {
    setSlots((prev) => {
      const next: Slots = { ...prev[group] };
      // limpa o time de qualquer posição anterior e a posição de qualquer time
      for (const p of [1, 2, 3]) if (next[p] === team) next[p] = undefined;
      next[pos] = team;
      return { ...prev, [group]: next };
    });
    setSaved((prev) => ({ ...prev, [group]: false }));
    setErrors((prev) => ({ ...prev, [group]: "" }));
  };

  const randomize = (group: GroupData) => {
    const shuffled = [...group.teams].sort(() => Math.random() - 0.5);
    setSlots((prev) => ({
      ...prev,
      [group.name]: { 1: shuffled[0], 2: shuffled[1], 3: shuffled[2] },
    }));
    setSaved((prev) => ({ ...prev, [group.name]: false }));
    setErrors((prev) => ({ ...prev, [group.name]: "" }));
  };

  const save = async (group: GroupData) => {
    const s = slots[group.name] ?? {};
    if (!s[1] || !s[2] || !s[3]) return;
    setSaving((prev) => ({ ...prev, [group.name]: true }));
    setErrors((prev) => ({ ...prev, [group.name]: "" }));
    try {
      const res = await fetch("/api/copa/grupos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_name: group.name,
          first_team: s[1],
          second_team: s[2],
          third_team: s[3],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors((prev) => ({ ...prev, [group.name]: data?.error ?? "Erro ao salvar" }));
      } else {
        setSaved((prev) => ({ ...prev, [group.name]: true }));
      }
    } catch {
      setErrors((prev) => ({ ...prev, [group.name]: "Erro de conexão" }));
    } finally {
      setSaving((prev) => ({ ...prev, [group.name]: false }));
    }
  };

  const now = Date.now();

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-green-400">Quem passa de grupo?</h2>
        <p className="text-xs text-emerald-100/70">
          Marque o 1º, 2º e 3º de cada grupo. Cada posição certa vale +10 pts.
          Dá pra editar até a última rodada do grupo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map((group) => {
          const s = slots[group.name] ?? {};
          const locked = new Date(group.lockAt).getTime() <= now;
          const complete = !!(s[1] && s[2] && s[3]);
          const posOf = (team: string) =>
            ([1, 2, 3] as const).find((p) => s[p] === team);

          return (
            <div
              key={group.name}
              className="rounded-xl border border-emerald-800/60 bg-emerald-950/60 overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-800/60">
                <h3 className="text-sm font-bold text-white">Grupo {group.name}</h3>
                <div className="flex items-center gap-3 text-[10px] text-emerald-100/60">
                  <span>Posição:</span>
                  <span className="font-bold text-emerald-100/90">1º</span>
                  <span className="font-bold text-emerald-100/90">2º</span>
                  <span className="font-bold text-emerald-100/90">3º</span>
                </div>
              </div>

              <div className="p-2 space-y-1.5">
                {group.teams.map((team) => {
                  const pos = posOf(team);
                  return (
                    <div
                      key={team}
                      className={`flex items-center justify-between rounded-md px-3 py-2 transition-colors ${
                        pos ? POS_STYLES[pos] : "bg-white/5 text-white"
                      }`}
                    >
                      <span className="text-sm font-medium truncate pr-2">{team}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {([1, 2, 3] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            disabled={locked || !isParticipant}
                            onClick={() => setPick(group.name, team, p)}
                            aria-label={`${team} em ${p}º`}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              s[p] === team
                                ? "border-white bg-transparent"
                                : pos
                                  ? "border-white/50"
                                  : "border-emerald-400/60 hover:border-green-400"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {s[p] === team && <span className="w-2.5 h-2.5 rounded-full bg-white" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-2 pb-2 space-y-1.5">
                {errors[group.name] && (
                  <p className="text-[11px] text-red-400 px-1">{errors[group.name]}</p>
                )}
                {locked ? (
                  <div className="flex items-center justify-center gap-1.5 rounded-md bg-white/5 py-2 text-xs text-emerald-100/60">
                    <Lock size={12} /> Encerrado — última rodada em andamento
                  </div>
                ) : !isParticipant ? (
                  <div className="rounded-md bg-white/5 py-2 text-center text-xs text-emerald-100/60">
                    Inscreva-se na Zafe Copa para palpitar
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => randomize(group)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-green-600 hover:bg-green-500 text-white text-xs font-bold uppercase py-2 transition-colors"
                    >
                      <Shuffle size={13} /> Sorteio aleatório
                    </button>
                    <button
                      type="button"
                      disabled={!complete || saving[group.name] || saved[group.name]}
                      onClick={() => save(group)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-green-400 hover:bg-green-300 text-black text-xs font-bold uppercase py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {saving[group.name] ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : saved[group.name] ? (
                        <>
                          <Check size={13} /> Salvo
                        </>
                      ) : (
                        "Salvar"
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
