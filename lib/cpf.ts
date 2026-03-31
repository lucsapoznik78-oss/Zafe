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
