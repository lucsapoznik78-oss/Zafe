import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return "Z$ " + new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function applyCommission(amount: number): number {
  return amount * 0.96;
}

export function commissionAmount(amount: number): number {
  return amount * 0.04;
}

export function timeUntil(date: string): string {
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return "Encerrado";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export const CATEGORIES = [
  { value: "politica", label: "Política" },
  { value: "esportes", label: "Esportes" },
  { value: "cultura", label: "Cultura" },
  { value: "economia", label: "Economia" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "entretenimento", label: "Entretenimento" },
  { value: "outros", label: "Outros" },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  politica: "bg-blue-500/20 text-blue-300",
  esportes: "bg-orange-500/20 text-orange-300",
  cultura: "bg-purple-500/20 text-purple-300",
  economia: "bg-yellow-500/20 text-yellow-300",
  tecnologia: "bg-cyan-500/20 text-cyan-300",
  entretenimento: "bg-pink-500/20 text-pink-300",
  outros: "bg-zinc-500/20 text-zinc-300",
};
