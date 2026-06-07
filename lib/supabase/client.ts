import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === "undefined") return [];
          const cookies = document.cookie.split("; ").filter(Boolean);
          return cookies.map((c) => {
            const [name, ...rest] = c.split("=");
            return { name, value: rest.join("=") };
          });
        },
        setAll(cookiesToSet) {
          if (typeof document === "undefined") return;
          // Em HTTPS, força Secure mesmo que o Supabase não envie a opção.
          const isHttps =
            typeof location !== "undefined" && location.protocol === "https:";
          cookiesToSet.forEach(({ name, value, options }) => {
            let cookie = `${name}=${value}`;
            cookie += `; path=${options?.path ?? "/"}`;
            if (options?.maxAge) cookie += `; max-age=${options.maxAge}`;
            if (options?.domain) cookie += `; domain=${options.domain}`;
            // SameSite=Lax por padrão para mitigar CSRF (Strict quebraria o OAuth).
            cookie += `; samesite=${options?.sameSite ?? "lax"}`;
            // Secure sempre em produção (HTTPS). O browser ignora Secure em http://localhost.
            if (options?.secure || isHttps) cookie += `; secure`;
            // NOTA: HttpOnly não pode ser definido via document.cookie — o browser
            // o ignora silenciosamente. O cookie de sessão precisa ser legível por
            // JS para o client SSR funcionar; a proteção HttpOnly real é aplicada
            // pelo servidor (middleware) ao reescrever os cookies de auth.
            document.cookie = cookie;
          });
        },
      },
    }
  );
}
