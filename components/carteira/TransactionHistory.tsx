import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Transaction } from "@/types/database";
import { ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown, RotateCcw, Percent } from "lucide-react";

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  deposit: { label: "Depósito", color: "text-primary", icon: <ArrowDownToLine size={14} /> },
  withdraw: { label: "Saque", color: "text-nao", icon: <ArrowUpFromLine size={14} /> },
  bet_placed: { label: "Palpite realizado", color: "text-muted-foreground", icon: <TrendingDown size={14} /> },
  bet_won: { label: "Palpite ganho", color: "text-sim", icon: <TrendingUp size={14} /> },
  bet_refund: { label: "Reembolso", color: "text-primary", icon: <RotateCcw size={14} /> },
  commission: { label: "Comissão Zafe", color: "text-muted-foreground", icon: <Percent size={14} /> },
};

export default function TransactionHistory({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Histórico</h3>
        <p className="text-muted-foreground text-sm text-center py-6">Nenhuma transação ainda</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Histórico de Transações</h3>
      <div className="space-y-2">
        {transactions.map((tx) => {
          const config = TYPE_CONFIG[tx.type] ?? { label: tx.type, color: "text-white", icon: null };
          const isPositive = ["deposit", "bet_won", "bet_refund"].includes(tx.type);
          const isNegative = ["withdraw", "investimento realizado", "commission"].includes(tx.type);

          return (
            <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
              <div className="flex items-center gap-2.5">
                <div className={`${config.color} opacity-70`}>{config.icon}</div>
                <div>
                  <p className="text-sm text-white font-medium">{config.label}</p>
                  {tx.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{tx.description}</p>}
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${
                  isPositive ? "text-sim" : isNegative ? "text-nao" : "text-muted-foreground"
                }`}>
                  {isPositive ? "+" : isNegative ? "-" : ""}{formatCurrency(Math.abs(tx.net_amount))}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
