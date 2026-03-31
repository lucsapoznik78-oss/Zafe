/**
 * Sistema parimutual: quem ganhar divide o pool total proporcional ao que apostou.
 * odds = (pool_total × (1 - comissão)) / pool_do_seu_lado
 */
export function calcOdds(
  volumeSim: number,
  volumeNao: number
): { simOdds: number; naoOdds: number } {
  const total = volumeSim + volumeNao;

  if (total === 0) return { simOdds: 2.0, naoOdds: 2.0 };

  const simOdds = volumeSim > 0
    ? parseFloat(Math.min(total / volumeSim, 999).toFixed(2))
    : 999.0;

  const naoOdds = volumeNao > 0
    ? parseFloat(Math.min(total / volumeNao, 999).toFixed(2))
    : 999.0;

  return { simOdds, naoOdds };
}

export function formatOdds(odds: number): string {
  return `${odds.toFixed(2)}x`;
}
