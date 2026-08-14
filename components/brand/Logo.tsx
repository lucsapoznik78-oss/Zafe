/**
 * Logo da Zafe em SVG inline, pintado com os tokens do tema.
 *
 * Era `zafe-logo-full.png` — um PNG com fundo quase-preto chapado, sem
 * transparência. Num tema claro isso vira um retângulo escuro no canto de
 * toda página, e não há como recolorir um PNG em runtime. Em SVG inline o
 * `var()` resolve normalmente, porque o elemento está dentro do documento
 * (é a diferença para `app/icon.svg`, que o navegador busca isolado e por
 * isso continua com hex chapado — ver ROLLBACK.md).
 *
 * A geometria é cópia literal de `app/icon.svg`, o símbolo oficial. Nada
 * aqui redesenha a marca; só troca de onde vem a cor:
 *
 *   traço do Z, linha de tendência e ponto → --c-brand
 *   palavra ZAFE                           → --c-text
 *
 * Sem círculo de fundo de propósito. No PNG ele era `--bg`, ou seja, sempre
 * da cor da página — pintá-lo é redundante e quebra quando o logo aparece
 * sobre um card em vez de sobre o fundo.
 */

const MARCA = (
  <>
    <polyline
      points="15,62 38,45 62,55 85,38"
      stroke="rgb(var(--c-brand))"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity="0.6"
    />
    <g
      fill="none"
      stroke="rgb(var(--c-brand))"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="28" y1="30" x2="72" y2="30" />
      <line x1="72" y1="30" x2="28" y2="70" />
      <line x1="28" y1="70" x2="72" y2="70" />
    </g>
    <circle cx="85" cy="38" r="3.5" fill="rgb(var(--c-brand))" />
  </>
);

/** Símbolo sozinho — usado no mobile, onde não cabe a palavra. */
export function ZafeMarca({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Zafe">
      {MARCA}
    </svg>
  );
}

/** Símbolo + palavra. */
export default function ZafeLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 340 100" className={className} role="img" aria-label="Zafe">
      {MARCA}
      {/* `textLength` trava a largura: sem isso a palavra muda de tamanho se a
          Inter não tiver carregado ainda, e o header pula. */}
      <text
        x="118"
        y="68"
        textLength="212"
        lengthAdjust="spacing"
        fontSize="52"
        fontWeight="300"
        letterSpacing="10"
        fill="rgb(var(--c-text))"
        fontFamily="var(--font-sans), system-ui, sans-serif"
      >
        ZAFE
      </text>
    </svg>
  );
}
