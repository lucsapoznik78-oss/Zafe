/**
 * Supabase fake em memória para testes unitários (vitest).
 *
 * Implementa o subconjunto de PostgREST usado por lib/wallet.ts e
 * lib/order-matching.ts: from().select().eq().single(), update().eq().select(),
 * insert(), neq/gte/lte/in, order(), limit() e rpc().
 *
 * O hook `onRead` dispara após cada leitura (com o snapshot já copiado),
 * permitindo simular uma escrita concorrente entre a leitura e o
 * compare-and-set — exatamente a corrida que a trava otimista deve vencer.
 */

export type Row = Record<string, unknown>;

type Filter =
  | { op: "eq" | "neq" | "gte" | "lte"; col: string; val: unknown }
  | { op: "in"; col: string; val: unknown[] };

export class FakeDB {
  tables = new Map<string, Row[]>();
  rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  rpcHandler: (name: string, args: Record<string, unknown>) => { data: unknown; error: unknown } =
    () => ({ data: { status: "ok" }, error: null });
  /** Chamado após cada leitura — permite simular escrita concorrente. */
  onRead: ((table: string) => void) | null = null;

  seed(table: string, rows: Row[]) {
    this.tables.set(table, rows.map((r) => ({ ...r })));
  }

  rows(table: string): Row[] {
    return this.tables.get(table) ?? [];
  }

  row(table: string, match: Row): Row | undefined {
    return this.rows(table).find((r) =>
      Object.entries(match).every(([k, v]) => r[k] === v)
    );
  }

  client(): any {
    const db = this;
    return {
      from(table: string) {
        return new QueryBuilder(db, table);
      },
      rpc(name: string, args: Record<string, unknown>) {
        db.rpcCalls.push({ name, args });
        return Promise.resolve(db.rpcHandler(name, args));
      },
    };
  }
}

class QueryBuilder {
  private filters: Filter[] = [];
  private sorts: { col: string; ascending: boolean }[] = [];
  private limitN: number | null = null;
  private mode: "select" | "update" | "insert" = "select";
  private updateValues: Row | null = null;
  private insertValues: Row | Row[] | null = null;
  private returnRows = false; // .select() encadeado após .update()

  constructor(private db: FakeDB, private table: string) {}

  select(_cols?: string) {
    if (this.mode === "update") {
      this.returnRows = true;
    }
    return this;
  }

  update(values: Row) {
    this.mode = "update";
    this.updateValues = values;
    return this;
  }

  insert(values: Row | Row[]) {
    this.mode = "insert";
    this.insertValues = values;
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push({ op: "eq", col, val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push({ op: "neq", col, val });
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push({ op: "gte", col, val });
    return this;
  }
  lte(col: string, val: unknown) {
    this.filters.push({ op: "lte", col, val });
    return this;
  }
  in(col: string, val: unknown[]) {
    this.filters.push({ op: "in", col, val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.sorts.push({ col, ascending: opts?.ascending ?? true });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }

  single(): Promise<{ data: Row | null; error: unknown }> {
    const matched = this.matched();
    // Copia ANTES do hook: a leitura devolve o valor antigo, o hook pode
    // então mutar o banco para simular concorrência.
    const row = matched[0] ? { ...matched[0] } : null;
    this.db.onRead?.(this.table);
    return Promise.resolve({
      data: row,
      error: row ? null : { code: "PGRST116", message: "no rows" },
    });
  }

  // Torna o builder "thenable" — `await builder` executa a operação.
  then<T>(
    resolve: (v: { data: unknown; error: unknown }) => T,
    reject?: (e: unknown) => T
  ) {
    return this.exec().then(resolve, reject);
  }

  private exec(): Promise<{ data: unknown; error: unknown }> {
    if (this.mode === "insert") {
      const arr = Array.isArray(this.insertValues)
        ? this.insertValues
        : [this.insertValues!];
      const rows = this.db.tables.get(this.table) ?? [];
      rows.push(...arr.map((r) => ({ ...r })));
      this.db.tables.set(this.table, rows);
      return Promise.resolve({ data: null, error: null });
    }

    if (this.mode === "update") {
      const matched = this.matched();
      for (const row of matched) Object.assign(row, this.updateValues);
      return Promise.resolve({
        data: this.returnRows ? matched.map((r) => ({ ...r })) : null,
        error: null,
      });
    }

    // select de lista
    let rows = this.matched().map((r) => ({ ...r }));
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    this.db.onRead?.(this.table);
    return Promise.resolve({ data: rows, error: null });
  }

  /** Retorna REFERÊNCIAS às linhas (update muta o banco de verdade). */
  private matched(): Row[] {
    const rows = this.db.tables.get(this.table) ?? [];
    let out = rows.filter((r) =>
      this.filters.every((f) => {
        const v = r[f.col] as any;
        switch (f.op) {
          case "eq":
            return v === f.val;
          case "neq":
            return v !== f.val;
          case "gte":
            return v >= (f.val as any);
          case "lte":
            return v <= (f.val as any);
          case "in":
            return f.val.includes(v);
        }
      })
    );
    if (this.sorts.length) {
      out = [...out].sort((a, b) => {
        for (const s of this.sorts) {
          const av = a[s.col] as any;
          const bv = b[s.col] as any;
          if (av < bv) return s.ascending ? -1 : 1;
          if (av > bv) return s.ascending ? 1 : -1;
        }
        return 0;
      });
    }
    return out;
  }
}
