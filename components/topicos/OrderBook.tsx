import { formatCurrency } from "@/lib/utils";

interface OrderBookEntry {
  amount: number;
  count: number;
}

interface Props {
  simOrders: OrderBookEntry[];
  naoOrders: OrderBookEntry[];
}

export default function OrderBook({ simOrders, naoOrders }: Props) {
  const maxAmount = Math.max(
    ...simOrders.map((o) => o.amount),
    ...naoOrders.map((o) => o.amount),
    1
  );

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-4">Livro de Ordens</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex justify-between text-xs text-sim font-semibold mb-2">
            <span>SIM</span>
            <span>Volume</span>
          </div>
          <div className="space-y-1">
            {simOrders.length === 0 ? (
              <p className="text-muted-foreground text-xs text-center py-2">Sem ordens</p>
            ) : (
              simOrders.slice(0, 8).map((order, i) => (
                <div key={i} className="relative flex justify-between text-xs py-1 px-2 rounded overflow-hidden">
                  <div
                    className="absolute inset-0 bg-sim/10"
                    style={{ width: `${(order.amount / maxAmount) * 100}%` }}
                  />
                  <span className="relative text-white">{order.count}x</span>
                  <span className="relative text-sim">{formatCurrency(order.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-nao font-semibold mb-2">
            <span>NÃO</span>
            <span>Volume</span>
          </div>
          <div className="space-y-1">
            {naoOrders.length === 0 ? (
              <p className="text-muted-foreground text-xs text-center py-2">Sem ordens</p>
            ) : (
              naoOrders.slice(0, 8).map((order, i) => (
                <div key={i} className="relative flex justify-between text-xs py-1 px-2 rounded overflow-hidden">
                  <div
                    className="absolute inset-0 bg-nao/10"
                    style={{ width: `${(order.amount / maxAmount) * 100}%` }}
                  />
                  <span className="relative text-white">{order.count}x</span>
                  <span className="relative text-nao">{formatCurrency(order.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
