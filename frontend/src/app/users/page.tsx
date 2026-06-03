"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { usersApi, User, UserRole } from "@/lib/api";
import { cn, roleLabel, roleBadge, formatDate } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";

export default function UsersPage() {
  return <AppShell><UsersContent /></AppShell>;
}

function UsersContent() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<User & { password: string }>>({});
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "eleco" as UserRole });

  const { data: users = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: usersApi.list });

  const createMutation = useMutation({
    mutationFn: () => usersApi.create(newUser),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowAdd(false);
      setNewUser({ name: "", email: "", password: "", role: "eleco" });
      toast.success("Usuario creado");
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al crear usuario"),
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); toast.success("Usuario desactivado"); },
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500 mt-1">{users.length} usuarios registrados</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-blue-200 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Nuevo usuario</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nombre completo</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} placeholder="Juan García" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Email</label>
              <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} placeholder="usuario@empresa.com" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Contraseña</label>
              <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Rol</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as UserRole }))}>
                <option value="eleco">ELECO</option>
                <option value="admin_neogen">Admin Neogen</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!newUser.name || !newUser.email || !newUser.password}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Crear usuario
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Creado</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Cargando...</td></tr>
            ) : users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{user.name}</span>
                    {currentUser?.id === user.id && <span className="text-xs text-gray-400">(yo)</span>}
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-600">{user.email}</td>
                <td className="px-5 py-3 text-center">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", roleBadge(user.role))}>
                    {roleLabel(user.role)}
                  </span>
                </td>
                <td className="px-5 py-3 text-center">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                    user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                  )}>
                    {user.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(user.created_at)}</td>
                <td className="px-5 py-3 text-center">
                  {currentUser?.id !== user.id && (
                    <button
                      onClick={() => deleteMutation.mutate(user.id)}
                      className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                      title="Desactivar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
