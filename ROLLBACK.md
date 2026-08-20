# ROLLBACK — paleta de cores

A migração da paleta antiga (quase-preto + violeta) para a **grafite** (escuro
monocromático, ação em branco-giz) foi feita de modo que a volta seja **um
passo**, sem `git revert`.

As duas paletas convivem no repositório. O interruptor é o atributo `data-theme`
no `<html>`, escrito em `app/layout.tsx` a partir de `NEXT_PUBLIC_THEME`.

> Houve uma etapa intermediária, a `arquibancada` (azul-noite + amarelo-sol),
> que chegou a ir para produção e foi descartada: azul-marinho com destaque
> amarelo é a identidade da EstrelaBet e das Loterias Caixa, exatamente o
> vizinho de que a migração queria sair. Junto com ela foram descartadas três
> outras candidatas (`claro`, `papel`, `campo`). Nenhuma está mais no CSS; todas
> vivem no histórico do git, no commit "quatro paletas candidatas".

---

## Como voltar em 1 passo

```bash
NEXT_PUBLIC_THEME=legacy
```

Defina essa variável de ambiente (Vercel → Settings → Environment Variables, ou
`.env.local` em desenvolvimento) e faça o redeploy. Pronto: o app inteiro volta
ao visual antigo.

Se preferir não depender da Vercel, troque o fallback em `app/layout.tsx`:

```ts
const THEME = PEDIDO in THEME_COLORS ? PEDIDO : "grafite";
//                                              ^^^^^^^^^
//  troque este literal para "legacy" e o padrão passa a ser o visual antigo
```

Qualquer valor que não seja `legacy` nem `grafite` cai em `grafite` — o padrão
atual.

### Como conferir que voltou

```bash
curl -s https://www.zafe.app.br/liga | grep -o 'data-theme="[a-z]*"'
```

Deve responder `data-theme="legacy"`. Na tela: fundo quase-preto (`#0A0A0F`),
CTA violeta (`#7C5CFC`), verde `#22C55E` / vermelho `#F43F5E` no SIM/NÃO.

---

## Onde a cor mora

**`app/globals.css`** — fonte única de verdade. Dois blocos de tokens:

| bloco | tema |
|---|---|
| `:root[data-theme="legacy"]` | quase-preto + violeta (o visual antigo, intacto) |
| `:root, :root[data-theme="grafite"]` | escuro monocromático (o padrão hoje) |

O `grafite` também responde pelo `:root` pelado: se `data-theme` sumir por
qualquer motivo, o app cai nele em vez de ficar sem cor nenhuma —
`rgb(var(--indefinido))` é inválido e apagaria a interface inteira.
`[data-theme="legacy"]` tem especificidade maior (0,2,0 contra 0,1,0) e continua
ganhando quando presente, que é o que faz o rollback funcionar.

As cores são **canais RGB soltos** (`15 16 18`), não hex, porque o Tailwind só
aplica modificador de opacidade (`bg-primary/10`) se receber os canais separados.

**`tailwind.config.ts`** — só aponta para as variáveis, via `rgb(var(--c-x) / …)`.
Não há hex neste arquivo, e não deve voltar a haver: hex aqui é invisível ao
interruptor.

Nada foi apagado do `legacy`. O bloco é a paleta antiga literal, canal por canal.

---

## O que NÃO volta sozinho

O interruptor cobre tudo que passa pelo CSS do documento. Estes quatro pontos
ficam fora dele — cada um por um motivo técnico, não por descuido. Todos estão
fixados na paleta grafite e precisam de ação manual para reverter.

### 1. Favicon — `app/icon.svg`

O navegador busca esse arquivo isolado, fora do documento: não existe `:root`,
então `var(--brand)` não resolveria. Hex chapado por necessidade.

```bash
cp public/icon-legacy.svg app/icon.svg
```

### 2. Ícones binários (PNG / ICO)

São imagens rasterizadas: não seguem o interruptor `data-theme` e precisam de
ação manual. O original roxo de cada uma está salvo ao lado, com sufixo
`-legacy`. Para voltar, copie por cima — repare que dois deles moram em `app/`,
não em `public/`:

```bash
cp public/favicon-legacy.ico    app/favicon.ico
cp public/apple-icon-legacy.png app/apple-icon.png
cp public/favicon-32-legacy.png public/favicon-32.png
cp public/icon-192-legacy.png   public/icon-192.png
cp public/icon-512-legacy.png   public/icon-512.png
cp public/zafe-icon-legacy.png  public/zafe-icon.png
cp public/zafe-logo-full-legacy.png public/zafe-logo-full.png
```

Os grafite não foram redesenhados: são o mesmo traço recolorido por projeção de
cor. Cada pixel é projetado no eixo `#151123 → #5E4BA7` (fundo → violeta mais
claro da arte antiga) e o fator resultante reposicionado no eixo
`#0F1012 → #F0F1F3`. Converter por luminância teria achatado o degradê do raio;
a projeção preserva a profundidade. `public/zafe-icon.png` é o mestre — os
outros tamanhos saem dele por Lanczos, e o `.ico` leva 16px e 32px.

> `zafe-logo-full.png` e `zafe-icon.png` **saíram de uso** no app. O logo virou
> SVG inline em `components/brand/Logo.tsx`, pintado pelos tokens, e por isso é
> o único asset de marca que acompanha o interruptor. O `zafe-icon.png` segue
> valendo como mestre dos ícones binários acima.

### 3. Manifest PWA — `public/manifest.json`

```json
"background_color": "#0A0A0F",
"theme_color":      "#0A0A0F"
```

Hoje os dois estão em `#0F1012`. O `<meta name="theme-color">` do documento, em
contrapartida, **acompanha o interruptor** (`app/layout.tsx`, const `THEME_COLOR`)
— não precisa mexer.

### 4. Imagem de OG / Twitter card — `app/api/og/route.tsx`

Satori (`next/og`) renderiza fora do documento: não existe `:root`, `var()` não
resolve. A paleta está no topo do arquivo, na constante `C`. Para reverter,
troque os valores dela pelos do legacy:

```
bg #0A0A0F · brand #7C5CFC · text #F5F5F7 · textSec #9A9AA8
textMuted #6A6A78 · onAccent #FFFFFF · yes/yesText #22C55E · no/noText #F43F5E
```

### 5. Email transacional — `app/api/cron/finalizar-concurso/route.ts`

Cliente de email não resolve `var()` nem carrega CSS externo; a paleta vem
chapada no atributo `style`. É o único template de email do app. Para reverter,
os valores antigos eram:

```
#0a0a0a (fundo) · #fafafa (texto) · #facc15 (destaque) · #d4d4d8 (apoio)
#fde68a (realce) · #71717a (discreto) · rgba(250,204,21,…) (tinta do destaque)
```

---

## Exceções declaradas (cor que continua em hex, de propósito)

Não são esquecimento: são escalas em que a cor **é o dado**, e mapear para os
tokens colapsaria estados distinguíveis num tom só.

| arquivo | o que é |
|---|---|
| `lib/escalacao/cores.ts` | 9 cores por esporte |
| `components/games/RankBadge.tsx` | escala ordinal de 7 degraus (ferro → o topo) |
| `components/perfil/FiguraBuilder.tsx`, `app/api/perfil/figura/*` | tons de pele e cabelo |
| `components/auth/LoginForm.tsx` | as 4 cores da marca Google no botão |
| `components/ligas/CreateLigaModal.tsx`, `app/api/ligas/criar/route.ts` | cor de identidade escolhida pelo dono do grupo |
| `components/topicos/ProbabilityChart.tsx` | paleta de séries para eventos multi-resultado |
| `components/figura3d/*` | o palco 3D: fundo, luzes e cores de material. Não é interface, é cena — a rim light só desenha contra fundo escuro, e o token do tema claro apagaria o efeito nos dois temas |

As duas últimas ainda trazem `#FFC53D` (o amarelo da `arquibancada`) no primeiro
slot. São escalas categóricas, não cromo de interface: no grafite a marca é
branca, e branco nesse lugar viraria a série "sem cor" — colidiria com o texto
comum em vez de identificar. Ficam como estão até alguém decidir a escala nova.
