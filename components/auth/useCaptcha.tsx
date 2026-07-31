"use client";

/**
 * Turnstile para os endpoints de autenticação do Supabase.
 *
 * Por que precisa existir: a autenticação da Zafe é 100% client-side — o
 * browser fala direto com `supabase.co/auth/v1/*` e nunca passa pela Vercel.
 * Nem o WAF da borda nem o rate limit do middleware enxergam uma tentativa de
 * login. CAPTCHA + os limites nativos do GoTrue são a única defesa que existe
 * contra credential stuffing.
 *
 * Por que é um hook e não um `useState` lido no submit: o token do Turnstile é
 * de USO ÚNICO e expira em ~300s, e um único submit pode bater em DOIS
 * endpoints protegidos — `signInWithPassword` e, se o 2FA estiver ligado, o
 * `signInWithOtp` logo em seguida. Um token não serve os dois. `obterToken()`
 * consome o token atual e já manda o widget gerar o próximo, então a segunda
 * chamada espera um token novo em vez de reenviar o mesmo.
 *
 * O outro modo de falha que isso evita: login que erra a senha mantém o
 * usuário no mesmo formulário. Sem o reset, o segundo submit reenviaria o
 * token já gasto, o GoTrue devolveria `captcha_failed` e o formulário diria
 * "Email ou senha inválidos" para quem digitou a senha certa.
 *
 * Inerte sem NEXT_PUBLIC_TURNSTILE_SITE_KEY, no mesmo padrão do
 * lib/ratelimit.ts: `widget` é null e `obterToken()` resolve `undefined`. Isso
 * permite subir este código com o CAPTCHA ainda DESLIGADO no Supabase — o
 * GoTrue ignora o campo extra enquanto está desabilitado, então a etapa de
 * verificação em produção pode acontecer antes de ligar o interruptor.
 */

import { useCallback, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Teto de espera por um token. O caso real é o CDN da Cloudflare bloqueado
 * (rede corporativa, DNS filtrado): sem o teto o formulário ficaria travado
 * para sempre num spinner.
 */
const TIMEOUT_MS = 20_000;

export function useCaptcha() {
  const ref = useRef<TurnstileInstance | undefined>(undefined);

  const obterToken = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY) return undefined;
    const api = ref.current;
    if (!api) return undefined;
    try {
      const token = await api.getResponsePromise(TIMEOUT_MS);
      // Consome: o widget passa a gerar o próximo token em background, então a
      // chamada seguinte (2FA, ou um novo submit depois de erro) não reusa este.
      api.reset();
      return token || undefined;
    } catch {
      // Sem token, a requisição segue sem o campo. Se o CAPTCHA já estiver
      // ligado no Supabase ela vai falhar — mas travar o formulário aqui
      // deixaria o usuário sem nenhum caminho, o que é pior.
      return undefined;
    }
  }, []);

  const widget = SITE_KEY ? (
    <div className="flex justify-center">
      <Turnstile
        ref={ref}
        siteKey={SITE_KEY}
        options={{ theme: "dark", language: "pt-BR", size: "flexible" }}
      />
    </div>
  ) : null;

  return { widget, obterToken };
}

/**
 * Monta o `options` das chamadas do supabase-js sem incluir a chave quando não
 * há token — assim o payload fica idêntico ao de hoje enquanto o CAPTCHA não
 * estiver configurado.
 */
export function comCaptcha<T extends object>(options: T, token: string | undefined) {
  return token ? { ...options, captchaToken: token } : options;
}
