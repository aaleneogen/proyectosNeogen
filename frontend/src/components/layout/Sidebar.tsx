"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Package, History } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Órdenes", icon: History },
  { href: "/products", label: "Productos", icon: Package },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-none">Neogen</p>
            <p className="text-xs text-gray-500 leading-tight mt-0.5">SAP Converter</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === href
                ? "bg-brand-50 text-brand-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">ELECO → SAP Business One</p>
        <p className="text-xs text-gray-400">Neogen Uruguay</p>
      </div>
    </aside>
  );
}
