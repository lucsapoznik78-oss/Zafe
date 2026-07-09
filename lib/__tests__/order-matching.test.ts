/**
 * Testes do engine de matching FIFO preço-tempo (lib/order-matching.ts).
 * O trade em si roda na RPC `execute_trade` (Postgres) — aqui validamos a
 * seleção de contra-ordens, prioridade, preço do maker, fills parciais,
 * proteção contra auto-trade e o reembolso de escrow no cancelamento.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { tryMatchOrders, cancelTopicOrders } from "@/lib/order-matching";
import { FakeDB, type Row } from "./helpers/fake-supabase";

const TOPIC = "topic-1";
const BUYER = "user-buyer";

let db: FakeDB;
let admin: any;

function order(partial: Row): Row {
  return {
    id: "o-" + Math.random().toString(36).slice(2, 8),
    topic_id: TOPIC,
    desafio_id: null,
    side: "sim",
    order_type: "sell",
    status: "open",
    user_id: "user-x",
    price: 0.5,
    quantity: 100,
    filled_qty: 0,
    created_at: "2026-07-01T10:00:00Z",
    source_bet_id: null,
    ...partial,
  };
}

beforeEach(() => {
  db = new FakeDB();
  db.seed("orders", []);
  db.seed("notifications", []);
  db.seed("wallets", []);
  db.seed("transactions", []);
  admin = db.client();
});

describe("tryMatchOrders — FIFO preço-tempo", () => {
  it("BUY casa com SELLs: melhor preço primeiro, depois mais antiga", async () => {
    db.seed("orders", [
      order({ id: "B1", order_type: "buy", user_id: BUYER, price: 0.7, quantity: 150 }),
      // Preço pior (0.65)
      order({ id: "S1", user_id: "u-a", price: 0.65, quantity: 100, created_at: "2026-07-01T10:00:00Z" }),
      // Melhor preço, mas mais recente
      order({ id: "S2", user_id: "u-b", price: 0.6, quantity: 100, created_at: "2026-07-01T11:00:00Z" }),
      // Melhor preço E mais antiga → primeira
      order({ id: "S3", user_id: "u-c", price: 0.6, quantity: 30, created_at: "2026-07-01T09:00:00Z" }),
    ]);

    const res = await tryMatchOrders(admin, "B1");

    expect(res).toEqual({ tradesExecuted: 3, totalFilled: 150 });
    const calls = db.rpcCalls.map((c) => c.args);
    expect(calls.map((a) => a.p_sell_order)).toEqual(["S3", "S2", "S1"]);
    expect(calls.map((a) => a.p_quantity)).toEqual([30, 100, 20]);
    // Executa ao preço do MAKER (contra-ordem), não do limite do comprador
    expect(calls.map((a) => a.p_price)).toEqual([0.6, 0.6, 0.65]);
    // 2 notificações por trade (comprador + vendedor)
    expect(db.rows("notifications")).toHaveLength(6);
  });

  it("SELL casa com BUY de maior preço primeiro", async () => {
    db.seed("orders", [
      order({ id: "S1", order_type: "sell", user_id: "u-seller", price: 0.5, quantity: 100 }),
      order({ id: "B1", order_type: "buy", user_id: "u-a", price: 0.55, quantity: 100 }),
      order({ id: "B2", order_type: "buy", user_id: "u-b", price: 0.6, quantity: 40 }),
      // Abaixo do preço de venda → incompatível
      order({ id: "B3", order_type: "buy", user_id: "u-c", price: 0.45, quantity: 100 }),
    ]);

    const res = await tryMatchOrders(admin, "S1");

    expect(res).toEqual({ tradesExecuted: 2, totalFilled: 100 });
    const calls = db.rpcCalls.map((c) => c.args);
    expect(calls.map((a) => a.p_buy_order)).toEqual(["B2", "B1"]);
    expect(calls.map((a) => a.p_quantity)).toEqual([40, 60]);
    expect(calls.map((a) => a.p_price)).toEqual([0.6, 0.55]);
  });

  it("não casa ordens do mesmo usuário (auto-trade)", async () => {
    db.seed("orders", [
      order({ id: "B1", order_type: "buy", user_id: BUYER, price: 0.7, quantity: 100 }),
      order({ id: "S1", user_id: BUYER, price: 0.6, quantity: 100 }),
    ]);
    const res = await tryMatchOrders(admin, "B1");
    expect(res).toEqual({ tradesExecuted: 0, totalFilled: 0 });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("não casa preços incompatíveis (SELL acima do limite do BUY)", async () => {
    db.seed("orders", [
      order({ id: "B1", order_type: "buy", user_id: BUYER, price: 0.5, quantity: 100 }),
      order({ id: "S1", user_id: "u-a", price: 0.6, quantity: 100 }),
    ]);
    const res = await tryMatchOrders(admin, "B1");
    expect(res).toEqual({ tradesExecuted: 0, totalFilled: 0 });
  });

  it("não casa lados diferentes nem tópicos diferentes", async () => {
    db.seed("orders", [
      order({ id: "B1", order_type: "buy", user_id: BUYER, price: 0.7, quantity: 100, side: "sim" }),
      order({ id: "S1", user_id: "u-a", price: 0.6, side: "nao" }),
      order({ id: "S2", user_id: "u-b", price: 0.6, topic_id: "outro-topico" }),
    ]);
    const res = await tryMatchOrders(admin, "B1");
    expect(res).toEqual({ tradesExecuted: 0, totalFilled: 0 });
  });

  it("ordem nova cancelada/cheia não casa nada", async () => {
    db.seed("orders", [
      order({ id: "B1", order_type: "buy", user_id: BUYER, price: 0.7, quantity: 100, status: "filled" }),
      order({ id: "S1", user_id: "u-a", price: 0.6 }),
    ]);
    const res = await tryMatchOrders(admin, "B1");
    expect(res).toEqual({ tradesExecuted: 0, totalFilled: 0 });
  });

  it("respeita filled_qty: só casa a quantidade restante", async () => {
    db.seed("orders", [
      order({ id: "B1", order_type: "buy", user_id: BUYER, price: 0.7, quantity: 100, filled_qty: 60, status: "partial" }),
      order({ id: "S1", user_id: "u-a", price: 0.6, quantity: 100, filled_qty: 70, status: "partial" }),
    ]);
    const res = await tryMatchOrders(admin, "B1");
    // restante do BUY = 40, restante do SELL = 30 → casa 30
    expect(res).toEqual({ tradesExecuted: 1, totalFilled: 30 });
    expect(db.rpcCalls[0].args.p_quantity).toBe(30);
  });

  it("RPC falha (fill_conflict) → pula a contra-ordem sem contar fill", async () => {
    db.seed("orders", [
      order({ id: "B1", order_type: "buy", user_id: BUYER, price: 0.7, quantity: 100 }),
      order({ id: "S1", user_id: "u-a", price: 0.6, quantity: 30, created_at: "2026-07-01T09:00:00Z" }),
      order({ id: "S2", user_id: "u-b", price: 0.6, quantity: 100, created_at: "2026-07-01T10:00:00Z" }),
    ]);
    let call = 0;
    db.rpcHandler = () => {
      call++;
      return call === 1
        ? { data: { status: "fill_conflict" }, error: null }
        : { data: { status: "ok" }, error: null };
    };

    const res = await tryMatchOrders(admin, "B1");

    // S1 falhou (não conta), S2 executou os 100 restantes
    expect(res).toEqual({ tradesExecuted: 1, totalFilled: 100 });
    expect(db.rpcCalls).toHaveLength(2);
    expect(db.rpcCalls[1].args.p_quantity).toBe(100);
  });
});

describe("cancelTopicOrders — reembolso de escrow", () => {
  it("expira ordens abertas e devolve escrow não executado do BUY", async () => {
    db.seed("wallets", [{ user_id: BUYER, balance: 0 }, { user_id: "u-seller", balance: 0 }]);
    db.seed("orders", [
      // BUY com 40/100 executado → escrow restante = 60 * 0.5 = Z$30
      order({ id: "B1", order_type: "buy", user_id: BUYER, price: 0.5, quantity: 100, filled_qty: 40, status: "partial" }),
      // SELL não tem escrow (vendedor detém a posição, não Z$)
      order({ id: "S1", order_type: "sell", user_id: "u-seller", price: 0.5, quantity: 100 }),
      // Ordem já cheia: não é tocada
      order({ id: "B2", order_type: "buy", user_id: BUYER, price: 0.5, quantity: 10, filled_qty: 10, status: "filled" }),
    ]);

    await cancelTopicOrders(admin, TOPIC);

    expect(db.row("orders", { id: "B1" })!.status).toBe("expired");
    expect(db.row("orders", { id: "S1" })!.status).toBe("expired");
    expect(db.row("orders", { id: "B2" })!.status).toBe("filled");

    expect(db.row("wallets", { user_id: BUYER })!.balance).toBe(30);
    expect(db.row("wallets", { user_id: "u-seller" })!.balance).toBe(0);

    const tx = db.rows("transactions");
    expect(tx).toHaveLength(1);
    expect(tx[0]).toMatchObject({ user_id: BUYER, type: "bet_refund", amount: 30 });
  });
});
