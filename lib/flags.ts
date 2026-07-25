// Feature flags de produto.
//
// CONCURSO_ENABLED: controla a exposição do Concurso (mundo pago, R$ via PIX).
// Fica DESLIGADO por padrão enquanto não há CNPJ + provedor PIX integrados —
// assim a plataforma pode ser divulgada só com a zona grátis (Z$ virtual),
// sem prometer prêmio em dinheiro. Para religar: NEXT_PUBLIC_CONCURSO_ENABLED=true.
export const CONCURSO_ENABLED =
  process.env.NEXT_PUBLIC_CONCURSO_ENABLED === "true";

// Home padrão pós-login. Com o Concurso ativo, cai no hub /inicio (herói pago
// + grade de módulos). Sem Concurso, a Liga é o produto principal grátis, então
// a entrada vai direto pra /liga — o hub /inicio segue acessível, só não é o
// destino padrão.
export const HOME_PATH = CONCURSO_ENABLED ? "/inicio" : "/liga";
