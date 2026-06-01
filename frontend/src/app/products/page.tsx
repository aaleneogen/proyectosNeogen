"use client";
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { Plus, Upload, Search, Edit2, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { productsApi, Product } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Product>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState({ sku: "", description: "", price: 0, synonyms: [] as string[] });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productsApi.list,
  });

  const importMutation = useMutation({
    mutationFn: productsApi.import,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Importado: ${result.created} nuevos, ${result.updated} actualizados`);
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} errores en la importación`);
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Error al importar"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) => productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditingId(null);
      toast.success("Producto actualizado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: productsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto desactivado");
    },
  });

  const createMutation = useMutation({
    mutationFn: () => productsApi.create({ ...newProduct, is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowAdd(false);
      setNewProduct({ sku: "", description: "", price: 0, synonyms: [] });
      toast.success("Producto creado");
    },
  });

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) importMutation.mutate(files[0]);
  }, [importMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const filtered = products.filter((p) =>
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Base de productos</h1>
          <p className="text-gray-500 mt-1">{products.length} productos en la base de datos</p>
        </div>
        <div className="flex gap-3">
          <div
            {...getRootProps()}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium cursor-pointer transition-colors",
              isDragActive ? "border-brand-500 bg-brand-50 text-brand-700" : "hover:bg-gray-50 text-gray-700"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="w-4 h-4" />
            {importMutation.isPending ? "Importando..." : "Importar Excel/CSV"}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo producto
          </button>
        </div>
      </div>

      {/* Import hint */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <strong>Formato para importar:</strong> El archivo debe tener columnas SKU, DESCRIPCION, PRECIO
        (y opcionalmente SINONIMOS separados por |)
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por SKU o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-white border border-brand-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Nuevo producto</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">SKU</label>
              <input
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                value={newProduct.sku}
                onChange={(e) => setNewProduct((p) => ({ ...p, sku: e.target.value }))}
                placeholder="T-700001234"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Descripción</label>
              <input
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={newProduct.description}
                onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
                placeholder="Petrifilm EC"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Precio (USD)</label>
              <input
                type="number"
                step="0.01"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={newProduct.price}
                onChange={(e) => setNewProduct((p) => ({ ...p, price: parseFloat(e.target.value) }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancelar
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!newProduct.sku || !newProduct.description}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              Crear producto
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">SKU</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descripción</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Precio</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Sinónimos</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin resultados</td></tr>
            ) : filtered.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                isEditing={editingId === product.id}
                editValues={editValues}
                onEdit={() => { setEditingId(product.id); setEditValues(product); }}
                onSave={() => updateMutation.mutate({ id: product.id, data: editValues })}
                onCancel={() => setEditingId(null)}
                onDelete={() => deleteMutation.mutate(product.id)}
                onEditChange={(field, value) => setEditValues((p) => ({ ...p, [field]: value }))}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductRow({ product, isEditing, editValues, onEdit, onSave, onCancel, onDelete, onEditChange }: any) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{product.sku}</span>
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <input
            className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
            value={editValues.description || ""}
            onChange={(e) => onEditChange("description", e.target.value)}
          />
        ) : (
          <span className="text-gray-700">{product.description}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <input
            type="number"
            step="0.01"
            className="border border-gray-300 rounded px-2 py-1 text-sm w-28"
            value={editValues.price ?? ""}
            onChange={(e) => onEditChange("price", parseFloat(e.target.value))}
          />
        ) : (
          <span className="font-medium">{formatCurrency(product.price)}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {(product.synonyms || []).map((s: string, i: number) => (
            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{s}</span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full font-medium",
          product.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
        )}>
          {product.is_active ? "Activo" : "Inactivo"}
        </span>
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <div className="flex gap-1">
            <button onClick={onSave} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={onCancel} className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex gap-1">
            <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
