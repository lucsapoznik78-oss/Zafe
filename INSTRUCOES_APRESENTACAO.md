# INSTRUÇÕES - APRESENTAÇÃO ZAFE (Reveal.js)

## ARQUIVO PRINCIPAL
`apresentacao_zafe_reveal.html` - Apresentação profissional em formato Reveal.js

## COMO USAR

### 1. Abrir o arquivo
- Dê duplo-clique no arquivo `.html` OU
- Arraste o arquivo para o navegador (Chrome, Firefox, Safari)

### 2. Navegação
- **Seta Direita / Espaço**: Próximo slide
- **Seta Esquerda / Shift+Espaço**: Slide anterior
- **Tecla O**: Modo Overview (ver todos os slides)
- **Tecla S**: Speaker Notes (notas do apresentador)
- **Tecla P**: Exportar para PDF (imprimir)

### 3. Exportar para PDF
1. Abra a apresentação
2. Pressione **P** OU acesse `?print-pdf` na URL
3. Exemplo: `file:///Users/mac/Downloads/zafe/apresentacao_zafe_reveal.html?print-pdf`
4. Use Ctrl+P (Cmd+P no Mac) para imprimir/salvar como PDF

### 4. Modo Speaker (Apresentador)
1. Pressione **S** durante a apresentação
2. Abre janela com slide atual, próximo slide e notas
3. Ideal para apresentações profissionais

## PERSONALIZAÇÃO

### Editar texto
- Abra o arquivo `.html` em qualquer editor de texto (VSCode, Notepad, etc.)
- Procure pela seção `<div class="slides">`
- Cada `<section>` é um slide
- Edite o conteúdo diretamente no HTML

### Mudar tema
Na linha 7, altere:
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/theme/black.css">
```
Opções: `black`, `white`, `league`, `beige`, `sky`, `night`, `serif`, `simple`, `solarized`

### Mudar transição
No JavaScript (linha ~580), altere:
```javascript
transition: 'slide', // Opções: none/fade/slide/convex/concave/zoom
```

### Adicionar novos slides
Copie uma seção existente:
```html
<section>
  <h2>Título do Novo Slide</h2>
  <p>Seu conteúdo aqui</p>
</section>
```

## ESTRUTURA ATUAL (12 Slides)
1. **Capa** - ZAFE + "Feito por Luc Sapoznik e Lorenzo Fragali"
2. **Quem Somos** - Essência + O que NÃO somos + Modelo de negócio
3. **Por que somos uma Liga** - CMN 5.298 + Proteção jurídica
4. **Zafe Econômico** - APIs + Futuro: conversão Z$ em descontos
5. **Zafe Liga** - Pilar principal (sem "carro-chefe")
6. **Concurso** - Lei 5.768/71 + Distribuição (sem mínimo)
7. **Privadas** - 4 travas legais + Juízes + Futuro
8. **Resolução** - 4 camadas (sem Claude)
9. **Estado Atual** - Zafes + 1.000 usuários + "quando acabarmos de aprimorar"
10. **Curto Prazo** - CNPJ, Domínio, Email, Redes Sociais, Advertising
11. **Médio/Longo Prazo** - Premium + Parcerias + Troca Zafes (sem clone/API/internacional)
12. **Fechamento** - Créditos aumentados

## NOTAS DO APRESENTADOR
As notas estão no código (dentro de `<aside class="notes">`). 
Para ver durante a apresentação, pressione **S**.

## DIFERENÇAS DA VERSÃO ANTERIOR
- ✅ Formato Reveal.js (profissional)
- ✅ Navegação por teclado
- ✅ Modo Overview (tecla O)
- ✅ Speaker Notes (tecla S)
- ✅ Exportação PDF (tecla P)
- ✅ Sem emojis
- ✅ Mais formal e rígido
- ✅ Créditos "FEITO POR LUC SAPOZNIK E LORENZO FRAGALI" em todos os slides
- ✅ Removeu TODAS as menções a "comissão"
- ✅ Slide Curto Prazo dedicado (CNPJ, Domínio, Email, Redes Sociais)

## DICAS PARA APRESENTAÇÃO
1. **Pratique** a navegação antes de apresentar
2. Use o **Modo Overview (O)** para pular rapidamente entre slides
3. As **Speaker Notes (S)** são ideais para lembrar pontos importantes
4. Para **imprimir PDF**, use a tecla **P** (melhor qualidade)
5. Em **telas projetadas**, use o modo tela cheia (F11)

## SUPORTE
- Reveal.js Docs: https://revealjs.com/
- Dúvidas: Luc Sapoznik e Lorenzo Fragali

---
**Versão:** 2.0 (Reveal.js Professional)
**Data:** Maio 2026
**Autores:** Luc Sapoznik e Lorenzo Fragali
