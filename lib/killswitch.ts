/**
 * Interruptor de emergência do rate limit.
 *
 * Por que não é uma env var sozinha: na Vercel, env var só passa a valer no
 * próximo deploy. Um `RATELIMIT_DISABLED` puro não é um kill switch — é um
 * deploy com etapa extra. Ela fica aqui só como segunda escotilha, para o caso
 * de o Edge Config estar inacessível ou nem existir.
 *
 * Por que não é uma chave no Redis: o motivo mais provável para querer o
 * interruptor é exatamente "o Upstash está degradado e as policies
 * `failClosed: true` estão devolvendo 503 em toda escrita de dinheiro". Ler o
 * interruptor do mesmo Redis que caiu não funciona. O Edge Config é um domínio
 * de falha independente, propaga em segundos e não exige deploy.
 *
 * Regra que atravessa o arquivo inteiro: **falha ao ler o interruptor nunca
 * desarma a proteção**. Se tratássemos erro de leitura como "desligado", cada
 * soluço do Edge Config converteria silenciosamente todo fail-closed em
 * fail-open — um bug pior que o problema que o interruptor resolve.
 */

import { get } from "@vercel/edge-config";

/** Chave lida no Edge Config. Valor esperado: booleano `true`. */
const CHAVE = "ratelimit_disabled";

/**
 * O cache existe para não pagar uma leitura por requisição. 10s é curto o
 * bastante para o interruptor continuar valendo como resposta a incidente
 * (a promessa de propagação do Edge Config já é da ordem de segundos) e longo
 * o bastante para o custo sumir sob qualquer tráfego realista.
 */
const TTL_MS = 10_000;

let cache: { valor: boolean; expiraEm: number } | null = null;

export async function rateLimitDesligado(): Promise<boolean> {
  // Escotilha sem rede: vale imediatamente, mas exige redeploy para mudar.
  if (process.env.RATELIMIT_DISABLED === "1") return true;

  // Sem a store configurada o módulo é inerte, no mesmo padrão do
  // lib/ratelimit.ts — o deploy não quebra enquanto o Edge Config não existir.
  if (!process.env.EDGE_CONFIG) return false;

  const agora = Date.now();
  if (cache && cache.expiraEm > agora) return cache.valor;

  try {
    const valor = (await get(CHAVE)) === true;
    cache = { valor, expiraEm: agora + TTL_MS };
    return valor;
  } catch (err) {
    console.error("[killswitch] falha ao ler o Edge Config", err);
    // Sem cache aqui de propósito: o próximo request tenta de novo, senão uma
    // falha momentânea fixaria "protegido" por 10s sem necessidade — e, o que
    // importa mais, um Edge Config permanentemente quebrado nunca poderia
    // desligar a proteção por acidente.
    return false;
  }
}

/** Exposto só para os testes: zera o cache entre casos. */
export function _resetarCache() {
  cache = null;
}
