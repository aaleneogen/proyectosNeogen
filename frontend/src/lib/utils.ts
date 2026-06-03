import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { MatchConfidence, LineStatus, OrderStatus } from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function confidenceBadge(confidence: MatchConfidence) {
  switch (confidence) {
    case "high":   return { label: "Alto",      className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    case "medium": return { label: "Medio",     className: "bg-amber-100 text-amber-800 border-amber-200" };
    case "low":    return { label: "Bajo",      className: "bg-orange-100 text-orange-800 border-orange-200" };
    default:       return { label: "Sin match", className: "bg-red-100 text-red-800 border-red-200" };
  }
}

export function lineStatusBadge(status: LineStatus) {
  switch (status) {
    case "completed": return { label: "Completo",  icon: "🟢", className: "bg-emerald-100 text-emerald-800" };
    case "partial":   return { label: "Parcial",   icon: "🟠", className: "bg-amber-100 text-amber-800" };
    default:          return { label: "Pendiente", icon: "🟡", className: "bg-yellow-100 text-yellow-800" };
  }
}

export function orderStatusBadge(status: OrderStatus) {
  const map: Record<string, { label: string; className: string }> = {
    pending:    { label: "Pendiente",    className: "bg-gray-100 text-gray-700" },
    processing: { label: "Procesando",  className: "bg-blue-100 text-blue-700 animate-pulse" },
    review:     { label: "En revisión", className: "bg-amber-100 text-amber-700" },
    approved:   { label: "Aprobado",    className: "bg-indigo-100 text-indigo-700" },
    completed:  { label: "Completado",  className: "bg-emerald-100 text-emerald-700" },
    error:      { label: "Error",       className: "bg-red-100 text-red-700" },
  };
  return map[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
}

export function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(dateStr));
}

export function formatDateShort(dateStr: string) {
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(dateStr));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}

export function formatMonth(ym: string) {
  const [year, month] = ym.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${months[parseInt(month) - 1]} ${year}`;
}

export function roleLabel(role: string) {
  return role === "admin_neogen" ? "Admin Neogen" : "ELECO";
}

export function roleBadge(role: string) {
  return role === "admin_neogen"
    ? "bg-indigo-100 text-indigo-800"
    : "bg-sky-100 text-sky-800";
}
