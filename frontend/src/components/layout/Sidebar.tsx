"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, Package, History,
  Truck, BarChart3, Users, Settings, LogOut, FlaskConical
} from "lucide-react";
import { cn, roleLabel, roleBadge } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Pedidos", icon: History },
  { href: "/deliveries", label: "Entregas", icon: Truck, adminOnly: true },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  { href: "/users", label: "Usuarios", icon: Users, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAdmin } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const visible = navItems.filter((item) => !item.adminOnly || isAdmin());

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-none">Neogen · ELECO</p>
            <p className="text-xs text-gray-400 leading-tight mt-0.5 truncate">Portal de Pedidos</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visible.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-100",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-blue-600" : "text-gray-400")} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-gray-200">
        <div className="px-3 py-2 mb-1">
          <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", roleBadge(user?.role || ""))}>
              {roleLabel(user?.role || "")}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 w-full text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
