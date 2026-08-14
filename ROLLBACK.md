# ROLLBACK — paleta de cores

A migração da paleta antiga (quase-preto + violeta) para a **arquibancada**
(azul-noite + amarelo-sol) foi feita de modo que a volta seja **um passo**, sem
`git revert`.

As duas paletas convivem no repositório. O interruptor é o atributo `data-theme`
no `<html>`, escrito em `app/layout.tsx` a partir de `NEXT_PUBLIC_THEME`.

---

## Como voltar em 1 passo

```bash
NEXT_PUBLIC_THEME=legacy
```

Defina essa variável de ambiente (Vercel → Settings → Environment Variables, ou
`.env.local` em desenvolvimento) e faça o redeploy. Pronto: o app inteiro volta
ao visual antigo.

Se preferir não depender da Vercel, troque o fallback em `app/layout.tsx:17`:

```ts
const THEME =
  process.env.NEXT_PUBLIC_THEME === "legacy" ? "legacy" : "arquibancada";
//                                                        ^^^^^^^^^^^^^^
//  troque este literal para "legacy" e o padrão passa a ser o visual antigo
```

Qualquer valor diferente de `legacy` cai em `arquibancada` — o padrão atual.

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
| `:root, :root[data-theme="arquibancada"]` | azul-noite + amarelo (o padrão hoje) |

As cores são **canais RGB soltos** (`13 27 42`), não hex, porque o Tailwind só
aplica modificador de opacidade (`bg-primary/10`) se receber os canais separados.

**`tailwind.config.ts`** — só aponta para as variáveis, via `rgb(var(--c-x) / …)`.
Não há hex neste arquivo, e não deve voltar a haver: hex aqui é invisível ao
interruptor.

Nada foi apagado. O bloco `legacy` é a paleta antiga literal, canal por canal.

---

## O que NÃO volta sozinho

O interruptor cobre tudo que passa pelo CSS do documento. Estes cinco pontos
ficam fora dele — cada um por um motivo técnico, não por descuido. Todos estão
fixados na paleta arquibancada e precisam de ação manual para reverter.

### 1. Favicon — `app/icon.svg`

O navegador busca esse arquivo isolado, fora do documento: não existe `:root`,
então `var(--brand)` não resolveria. Hex chapado por necessidade.

```bash
cp public/icon-legacy.svg app/icon.svg
```

### 2. Ícones binários (PNG / ICO)

São imagens rasterizadas — código não recolore PNG. O original de cada um está
salvo ao lado, com sufixo `-legacy`. Para voltar, copie por cima:

```bash
cd public
cp favicon-legacy.ico       favicon.ico
cp favicon-32-legacy.png    favicon-32.png
cp icon-192-legacy.png      icon-192.png
cp icon-512-legacy.png      icon-512.png
cp apple-icon-legacy.png    apple-icon.png
cp zafe-icon-legacy.png     zafe-icon.png
cp zafe-logo-full-legacy.png zafe-logo-full.png
```

> Atenção: hoje esses arquivos **ainda são os roxos**. A migração não os
> substituiu porque não dá para recriá-los por código — ver a lista de assets
> pendentes na entrega. Quando os novos chegarem, as cópias `-legacy` continuam
> sendo o caminho de volta.

### 3. Manifest PWA — `public/manifest.json`

```json
"background_color": "#0A0A0F",
"theme_color":      "#0A0A0F"
```

Hoje os dois estão em `#0D1B2A`. O `<meta name="theme-color">` do documento, em
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

## Arquivos tocados

Dois commits, nesta ordem — só o segundo precisa ser desfeito se você quiser
voltar por git em vez de pelo interruptor:

1. **camada de tokens** — `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`.
   Cria as duas paletas e o interruptor. Zero mudança visual: o padrão desse
   commit ainda é `legacy`.
2. **substituição** — ~180 arquivos em `app/`, `components/`, mais os assets de
   marca. Troca cor crua por token e vira o padrão para `arquibancada`.

### Exceções declaradas (cor que continua em hex, de propósito)

Não são esquecimento: são escalas em que a cor **é o dado**, e mapear para os
tokens colapsaria estados distinguíveis num tom só.

| arquivo | o que é |
|---|---|
| `lib/escalacao/cores.ts` | 9 cores por esporte |
| `components/games/RankBadge.tsx` | escala ordinal de 7 degraus (ferro → o topo) |
| `components/perfil/FiguraBuilder.tsx`, `app/api/perfil/figura/*` | tons de pele e cabelo |
| `components/auth/LoginForm.tsx` | as 4 cores da marca Google no botão |
| `components/ligas/CreateLigaModal.tsx` | cor de identidade escolhida pelo dono do grupo |
| `components/topicos/ProbabilityChart.tsx` | paleta de séries para eventos multi-resultado |
