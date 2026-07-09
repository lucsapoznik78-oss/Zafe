/**
 * Testes da trava otimista (CAS) de lib/wallet.ts — o código mais crítico
 * do Zafe: nenhum caminho pode perder escrita, ficar negativo ou violar a
 * conservação de Z$.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  adjustBalance,
  creditBalance,
  debitBalance,
  adjustConcursoBalance,
  creditConcursoBalance,
  debitConcursoBalance,
} from "@/lib/wallet";
import { FakeDB } from "./helpers/fake-supabase";

const U1 = "user-1";
const U2 = "user-2";
const C1 = "concurso-1";
const C2 = "concurso-2";

let db: FakeDB;
let client: any;

beforeEach(() => {
  db = new FakeDB();
  db.seed("wallets", [
    { user_id: U1, balance: 100 },
    { user_id: U2, balance: 50 },
  ]);
  db.seed("concurso_wallets", [
    { user_id: U1, concurso_id: C1, balance: 100, updated_at: "old" },
    { user_id: U1, concurso_id: C2, balance: 40, updated_at: "old" },
  ]);
  client = db.client();
});

function balanceOf(userId: string): number {
  return db.row("wallets", { user_id: userId })!.balance as number;
}

function totalIssued(): number {
  return db.rows("wallets").reduce((s, w) => s + (w.balance as number), 0);
}

describe("adjustBalance — casos básicos", () => {
  it("credita e retorna o novo saldo", async () => {
    const res = await adjustBalance(client, U1, 25);
    expect(res).toEqual({ ok: true, balance: 125 });
    expect(balanceOf(U1)).toBe(125);
  });

  it("debita e retorna o novo saldo", async () => {
    const res = await adjustBalance(client, U1, -40);
    expect(res).toEqual({ ok: true, balance: 60 });
    expect(balanceOf(U1)).toBe(60);
  });

  it("permite zerar o saldo exato", async () => {
    const res = await adjustBalance(client, U1, -100);
    expect(res).toEqual({ ok: true, balance: 0 });
  });

  it("recusa débito que deixaria o saldo negativo (e não altera nada)", async () => {
    const res = await adjustBalance(client, U1, -100.01);
    expect(res).toEqual({ ok: false, reason: "insufficient" });
    expect(balanceOf(U1)).toBe(100);
  });

  it("carteira inexistente → missing", async () => {
    const res = await adjustBalance(client, "ghost", 10);
    expect(res).toEqual({ ok: false, reason: "missing" });
  });

  it("arredonda para 2 casas (sem lixo de ponto flutuante)", async () => {
    db.row("wallets", { user_id: U1 })!.balance = 0.1;
    const res = await adjustBalance(client, U1, 0.2);
    // 0.1 + 0.2 === 0.30000000000000004 sem o toFixed(2)
    expect(res).toEqual({ ok: true, balance: 0.3 });
  });

  it("creditBalance usa valor absoluto (crédito nunca vira débito)", async () => {
    const res = await creditBalance(client, U1, -30);
    expect(res).toEqual({ ok: true, balance: 130 });
  });

  it("debitBalance usa valor absoluto (débito nunca vira crédito)", async () => {
    const res = await debitBalance(client, U1, -30);
    expect(res).toEqual({ ok: true, balance: 70 });
  });
});

describe("adjustBalance — concorrência (CAS)", () => {
  it("re-tenta após conflito e conclui com o saldo atualizado", async () => {
    let interfered = false;
    db.onRead = (table) => {
      if (table === "wallets" && !interfered) {
        interfered = true;
        // Escrita concorrente entre a leitura e o compare-and-set
        db.row("wallets", { user_id: U1 })!.balance = 80;
      }
    };
    const res = await adjustBalance(client, U1, 10);
    // 1ª tentativa lê 100 mas o CAS falha; 2ª lê 80 e aplica 80+10
    expect(res).toEqual({ ok: true, balance: 90 });
    expect(balanceOf(U1)).toBe(90);
  });

  it("desiste após 5 conflitos seguidos → conflict, sem escrever nada", async () => {
    let reads = 0;
    db.onRead = (table) => {
      if (table === "wallets") {
        reads++;
        // Muda o saldo a CADA leitura → o CAS nunca casa
        db.row("wallets", { user_id: U1 })!.balance = 100 + reads;
      }
    };
    const res = await adjustBalance(client, U1, 10);
    expect(res).toEqual({ ok: false, reason: "conflict" });
    expect(reads).toBe(5); // MAX_RETRIES
    // O saldo é o da última interferência — adjustBalance nunca escreveu
    expect(balanceOf(U1)).toBe(105);
  });

  it("duas operações simultâneas não perdem escrita (lost update)", async () => {
    const [a, b] = await Promise.all([
      adjustBalance(client, U1, 10),
      adjustBalance(client, U1, -20),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    // Sem CAS o resultado seria 110 ou 80 (uma escrita sobrescreve a outra)
    expect(balanceOf(U1)).toBe(90);
  });

  it("várias operações concorrentes na mesma carteira somam corretamente", async () => {
    const results = await Promise.all([
      creditBalance(client, U1, 5),
      debitBalance(client, U1, 3),
      creditBalance(client, U1, 7),
    ]);
    for (const r of results) expect(r.ok).toBe(true);
    expect(balanceOf(U1)).toBe(109); // 100 + 5 - 3 + 7
  });
});

describe("conservação de Z$", () => {
  it("transferências entre carteiras mantêm a soma total constante", async () => {
    const before = totalIssued(); // 150
    for (let i = 0; i < 5; i++) {
      const d = await debitBalance(client, U1, 7);
      expect(d.ok).toBe(true);
      const c = await creditBalance(client, U2, 7);
      expect(c.ok).toBe(true);
    }
    expect(balanceOf(U1)).toBe(65);
    expect(balanceOf(U2)).toBe(85);
    expect(totalIssued()).toBe(before);
  });

  it("débito recusado não destrói Z$", async () => {
    const before = totalIssued();
    const res = await debitBalance(client, U2, 999);
    expect(res).toEqual({ ok: false, reason: "insufficient" });
    expect(totalIssued()).toBe(before);
  });
});

describe("adjustConcursoBalance — carteira ZC$ por concurso", () => {
  function concursoBalance(concursoId: string): number {
    return db.row("concurso_wallets", { user_id: U1, concurso_id: concursoId })!
      .balance as number;
  }

  it("debita apenas a carteira do concurso certo", async () => {
    const res = await debitConcursoBalance(client, U1, C1, 30);
    expect(res).toEqual({ ok: true, balance: 70 });
    expect(concursoBalance(C1)).toBe(70);
    expect(concursoBalance(C2)).toBe(40); // intocada
  });

  it("credita e atualiza updated_at", async () => {
    const res = await creditConcursoBalance(client, U1, C1, 10);
    expect(res).toEqual({ ok: true, balance: 110 });
    const row = db.row("concurso_wallets", { user_id: U1, concurso_id: C1 })!;
    expect(row.updated_at).not.toBe("old");
  });

  it("recusa débito insuficiente sem alterar o saldo", async () => {
    const res = await adjustConcursoBalance(client, U1, C2, -40.01);
    expect(res).toEqual({ ok: false, reason: "insufficient" });
    expect(concursoBalance(C2)).toBe(40);
  });

  it("carteira inexistente para o concurso → missing", async () => {
    const res = await adjustConcursoBalance(client, U2, C1, 10);
    expect(res).toEqual({ ok: false, reason: "missing" });
  });

  it("re-tenta após conflito e conclui (CAS)", async () => {
    let interfered = false;
    db.onRead = (table) => {
      if (table === "concurso_wallets" && !interfered) {
        interfered = true;
        db.row("concurso_wallets", { user_id: U1, concurso_id: C1 })!.balance = 90;
      }
    };
    const res = await adjustConcursoBalance(client, U1, C1, 10);
    expect(res).toEqual({ ok: true, balance: 100 }); // 90 + 10 na 2ª tentativa
  });
});
