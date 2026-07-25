// Feature flags de produto.
//
// CONCURSO_ENABLED: controla a exposição do Concurso (mundo pago, R$ via PIX).
// Fica DESLIGADO por padrão enquanto não há CNPJ + provedor PIX integrados —
// assim a plataforma pode ser divulgada só com a zona grátis (Z$ virtual),
// sem prometer prêmio em dinheiro. Para religar: NEXT_PUBLIC_CONCURSO_ENABLED=true.
export const CONCURSO_ENABLED =
  process.env.NEXT_PUBLIC_CONCURSO_ENABLED === "true";
