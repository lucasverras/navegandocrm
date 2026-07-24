import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { isToday, isTomorrow, isYesterday, differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// Humanized date for CRM UIs: "Hoje, 14:30" / "Amanhã, 10:00" / "Ontem, 09:00" /
// "Há 3 dias" (past, >1 day) / "Em 3 dias" (future, >1 day) / "25 de julho" (>7 days away).
// Callers should also show the full date (e.g. via `title` attribute) using formatDate().
export function formatHumanDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const time = format(d, "HH:mm");

  if (isToday(d)) return `Hoje, ${time}`;
  if (isTomorrow(d)) return `Amanhã, ${time}`;
  if (isYesterday(d)) return `Ontem, ${time}`;

  const diff = differenceInCalendarDays(d, new Date());
  if (diff < 0 && diff >= -7) return `Há ${Math.abs(diff)} dias`;
  if (diff > 0 && diff <= 7) return `Em ${diff} dias`;

  return format(d, "d 'de' MMMM", { locale: ptBR });
}

// Whole days between `date` and now — negative means in the past (overdue).
export function daysFromNow(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return differenceInCalendarDays(d, new Date());
}

export function formatCurrencyUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);
}
