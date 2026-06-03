import axios, { AxiosError } from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const api = axios.create({ baseURL: API_BASE, timeout: 120_000 });

// Inject token on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserRole = "admin_neogen" | "eleco";
export type OrderStatus = "pending" | "processing" | "review" | "approved" | "completed" | "error";
export type MatchConfidence = "high" | "medium" | "low" | "none";
export type LineStatus = "pending" | "partial" | "completed";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Delivery {
  id: string;
  order_line_id: string;
  quantity_delivered: number;
  delivery_date: string;
  notes?: string;
  created_by_id?: string;
  created_at: string;
}

export interface OrderLine {
  id: string;
  order_id: string;
  row_index: number;
  raw_description: string;
  raw_quantity: string;
  raw_price: string;
  matched_sku: string | null;
  matched_description: string | null;
  unit_price: number | null;
  quantity_ordered: number;
  quantity_delivered: number;
  quantity_pending: number;
  confidence: MatchConfidence;
  confidence_score: number;
  match_method: string;
  warnings: string[];
  manually_reviewed: boolean;
  is_valid: boolean;
  line_status: LineStatus;
  deliveries: Delivery[];
}

export interface PurchaseOrder {
  id: string;
  order_number?: string;
  original_filename: string;
  status: OrderStatus;
  distributor: string;
  notes?: string;
  created_at: string;
  processed_at?: string;
  exported_at?: string;
  parse_errors: string[];
  lines: OrderLine[];
  created_by_id?: string;
}

export interface OrderSummary {
  id: string;
  order_number?: string;
  original_filename: string;
  status: OrderStatus;
  distributor: string;
  created_at: string;
  line_count: number;
  lines_pending: number;
  lines_completed: number;
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

export interface MonthlyData { month: string; count: number; amount: number }
export interface TopProduct { sku: string; description: string; total_ordered: number; total_delivered: number; times_ordered: number }
export interface ReportSummary {
  total_orders: number;
  open_orders: number;
  completed_orders: number;
  total_lines: number;
  pending_lines: number;
  partial_lines: number;
  completed_lines: number;
  total_amount: number;
  delivered_amount: number;
  monthly_orders: MonthlyData[];
  top_products: TopProduct[];
}

// ── Auth API ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string): Promise<{ access_token: string; user: User }> => {
    const { data } = await api.post("/auth/login", { email, password });
    return data;
  },
  me: async (): Promise<User> => {
    const { data } = await api.get<User>("/auth/me");
    return data;
  },
};

// ── Orders API ────────────────────────────────────────────────────────────────

export const ordersApi = {
  upload: async (file: File): Promise<ProcessingResult> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post<ProcessingResult>("/orders/upload", form);
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
  updateLine: async (orderId: string, lineId: string, update: Partial<OrderLine>): Promise<OrderLine> => {
    const { data } = await api.patch<OrderLine>(`/orders/${orderId}/lines/${lineId}`, update);
    return data;
  },
  approve: async (orderId: string): Promise<PurchaseOrder> => {
    const { data } = await api.post<PurchaseOrder>(`/orders/${orderId}/approve`);
    return data;
  },
  export: async (orderId: string, orderNumber?: string): Promise<void> => {
    const response = await api.post(`/orders/${orderId}/export`, {}, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `SAP_${orderNumber || orderId.slice(0, 8)}.xlsx`);
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
  delete: async (id: string): Promise<void> => { await api.delete(`/products/${id}`); },
  import: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post("/products/import", form);
    return data;
  },
};

// ── Deliveries API ────────────────────────────────────────────────────────────

export const deliveriesApi = {
  register: async (lineId: string, quantity: number, notes?: string): Promise<Delivery> => {
    const { data } = await api.post<Delivery>(`/deliveries/lines/${lineId}`, { quantity_delivered: quantity, notes });
    return data;
  },
  getForLine: async (lineId: string): Promise<Delivery[]> => {
    const { data } = await api.get<Delivery[]>(`/deliveries/lines/${lineId}`);
    return data;
  },
  delete: async (id: string): Promise<void> => { await api.delete(`/deliveries/${id}`); },
};

// ── Users API ─────────────────────────────────────────────────────────────────

export const usersApi = {
  list: async (): Promise<User[]> => {
    const { data } = await api.get<User[]>("/users/");
    return data;
  },
  create: async (user: { name: string; email: string; password: string; role: UserRole }): Promise<User> => {
    const { data } = await api.post<User>("/users/", user);
    return data;
  },
  update: async (id: string, data: Partial<User & { password: string }>): Promise<User> => {
    const { res } = await api.put(`/users/${id}`, data) as any;
    return res?.data;
  },
  delete: async (id: string): Promise<void> => { await api.delete(`/users/${id}`); },
};

// ── Reports API ───────────────────────────────────────────────────────────────

export const reportsApi = {
  summary: async (): Promise<ReportSummary> => {
    const { data } = await api.get<ReportSummary>("/reports/summary");
    return data;
  },
};
