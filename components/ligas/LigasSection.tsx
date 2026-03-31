"use client";

import { useState } from "react";
import { Trophy, Plus } from "lucide-react";
import LigaCard from "./LigaCard";
import CreateLigaModal from "./CreateLigaModal";

interface Props {
  ligas: any[];
  currentUserId: string;
  friends: { id: string; username: string; full_name: string }[];
}

export default function LigasSection({ ligas, currentUserId, friends }: Props) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      {showCreate && <CreateLigaModal onClose={() => setShowCreate(false)} />}

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Trophy size={16} className="text-primary" />
            Minhas Ligas
            {ligas.length > 0 && (
              <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded text-xs">{ligas.length}</span>
            )}
          </h3>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium"
          >
            <Plus size={13} />
            Nova Liga
          </button>
        </div>

        {ligas.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <Trophy size={32} className="mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma liga ainda</p>
            <p className="text-xs text-muted-foreground">Crie uma liga e convide seus amigos para investir juntos</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors"
            >
              Criar minha primeira liga
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {ligas.map((liga) => (
              <LigaCard
                key={liga.id}
                liga={liga}
                currentUserId={currentUserId}
                friends={friends}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
