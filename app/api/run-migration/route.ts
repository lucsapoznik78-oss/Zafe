import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const { Pool } = require("pg");
    const ref = "mhckuhqyyfoapzgrqeco";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const pool = new Pool({
      host: "aws-0-us-east-1.pooler.supabase.com",
      port: 6543,
      user: `postgres.${ref}`,
      password: key,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 15000,
    });

    const sqlPath = path.join(process.cwd(), "supabase/migrations/_apply_029_036.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    const client = await pool.connect();
    try {
      await client.query(sql);
      return NextResponse.json({ ok: true, message: "Migrations 029-036 applied successfully" });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message, position: e.position, detail: e.detail }, { status: 500 });
    } finally {
      client.release();
      await pool.end();
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
