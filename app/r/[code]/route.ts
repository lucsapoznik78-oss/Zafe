import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = NextResponse.redirect(new URL("/login", base));

  // Cookie não-httpOnly para que o client possa ler e registrar o referral após login
  res.cookies.set("zafe_ref", code.toUpperCase(), {
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    path: "/",
    httpOnly: false,
    sameSite: "lax",
  });

  return res;
}
