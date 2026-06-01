import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { MatchConfidence } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function confidenceBadge(confidence: MatchConfidence) {
  switch (confidence) {
    case "high":
      return { label: "Alto", className: "bg-green-100 text-green-800 border-green-200" };
    case "medium":
      return { label: "Medio", className: "bg-yellow-100 text-yellow-800 border-yellow-200" };
    case "low":
      return { label: "Bajo", className: "bg-orange-100 text-orange-800 border-orange-200" };
    default:
      return { label: "Sin match", className: "bg-red-100 text-red-800 border-red-200" };
  }
}

export function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendiente", className: "bg-gray-100 text-gray-700" },
    processing: { label: "Procesando", className: "bg-blue-100 text-blue-700" },
    review: { label: "En revisión", className: "bg-yellow-100 text-yellow-700" },
    completed: { label: "Completado", className: "bg-green-100 text-green-700" },
    error: { label: "Error", className: "bg-red-100 text-red-700" },
  };
  return map[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
}

export function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "USD" }).format(value);
}
