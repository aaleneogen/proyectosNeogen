import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 120_000,
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrderStatus = "pending" | "processing" | "review" | "completed" | "error";
export type MatchConfidence = "high" | "medium" | "low" | "none";

export interface OrderLine {
  id: string;
  order_id: string;
  row_index: number;
  raw_description: string;
  raw_quantity: string;
  raw_price: string;
  matched_sku: string | null;
  matched_description: string | null;
  quantity: number | null;
  unit_price: number | null;
  confidence: MatchConfidence;
  confidence_score: number;
  match_method: string;
  warnings: string[];
  manually_reviewed: boolean;
  is_valid: boolean;
}

export interface PurchaseOrder {
  id: string;
  original_filename: string;
  status: OrderStatus;
  distributor: string;
  created_at: string;
  processed_at: string | null;
  exported_at: string | null;
  parse_errors: string[];
  lines: OrderLine[];
}

export interface OrderSummary {
  id: string;
  original_filename: string;
  status: OrderStatus;
  distributor: string;
  created_at: string;
  line_count: number;
}

export interface Product {
  id: string;
  sku: string;
  description: string;
  price: number;
  synonyms: string[];
  is_active: boolean;
  created_at: string;
}

export interface ProcessingResult {
  order_id: string;
  status: OrderStatus;
  lines_detected: number;
  lines_matched: number;
  lines_needs_review: number;
  parse_errors: string[];
}

// ── Orders API ────────────────────────────────────────────────────────────────

export const ordersApi = {
  upload: async (file: File): Promise<ProcessingResult> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post<ProcessingResult>("/orders/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  list: async (): Promise<OrderSummary[]> => {
    const { data } = await api.get<OrderSummary[]>("/orders/");
    return data;
  },

  get: async (id: string): Promise<PurchaseOrder> => {
    const { data } = await api.get<PurchaseOrder>(`/orders/${id}`);
    return data;
  },

  updateLine: async (
    orderId: string,
    lineId: string,
    update: Partial<Pick<OrderLine, "matched_sku" | "matched_description" | "quantity" | "unit_price">>
  ): Promise<OrderLine> => {
    const { data } = await api.patch<OrderLine>(`/orders/${orderId}/lines/${lineId}`, update);
    return data;
  },

  export: async (orderId: string): Promise<void> => {
    const response = await api.post(`/orders/${orderId}/export`, {}, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `SAP_Export_${orderId.slice(0, 8)}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

// ── Products API ──────────────────────────────────────────────────────────────

export const productsApi = {
  list: async (): Promise<Product[]> => {
    const { data } = await api.get<Product[]>("/products/");
    return data;
  },

  create: async (product: Omit<Product, "id" | "created_at">): Promise<Product> => {
    const { data } = await api.post<Product>("/products/", product);
    return data;
  },

  update: async (id: string, product: Partial<Product>): Promise<Product> => {
    const { data } = await api.put<Product>(`/products/${id}`, product);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/products/${id}`);
  },

  import: async (file: File): Promise<{ created: number; updated: number; errors: string[] }> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post("/products/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};
