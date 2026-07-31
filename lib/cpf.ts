/**
 * Veredito único do servidor sobre um CPF recusado.
 *
 * Distinguir "dígito inválido" de "já cadastrado em outra conta" transforma as
 * rotas de CPF num oráculo de enumeração: dá para varrer CPFs e descobrir quem
 * tem conta na Zafe. Os dois casos devolvem esta mesma string com o mesmo
 * status 422 — nem o corpo nem o status code separam um do outro.
 *
 * 422 e não 409: `Conflict` significa literalmente "conflita com estado
 * existente", então o próprio status code seria o vazamento. E não 400, que já
 * é usado por quatro motivos não relacionados em /api/perfil/completar —
 * compartilhar convidaria um edit futuro a reabrir a distinção sem querer.
 */
export const ERRO_CPF =
  "Não foi possível validar este CPF. Confira os números — se estiverem certos, fale com o suporte.";

/** Valida CPF brasileiro (algoritmo oficial da Receita Federal) */
export function validarCPF(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  // Rejeita sequências iguais (000...0, 111...1, etc.)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  function calcDigit(digits: string, weights: number[]): number {
    const sum = digits.split("").reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  }

  const d1 = calcDigit(cpf.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d1 !== parseInt(cpf[9])) return false;

  const d2 = calcDigit(cpf.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d2 !== parseInt(cpf[10])) return false;

  return true;
}

/** Formata CPF para exibição: 000.000.000-00 */
export function formatarCPF(raw: string): string {
  const cpf = raw.replace(/\D/g, "").slice(0, 11);
  return cpf
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Mascara para exibição segura: 012.345.678-** */
export function mascaraCPF(raw: string): string {
  const cpf = raw.replace(/\D/g, "");
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}
