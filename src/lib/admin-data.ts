import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_EXCHANGE_RATE } from "./constants";

export const STATUS_COLOR: Record<string, string> = {
  pending: "text-muted-foreground bg-surface",
  submitted: "text-blue-300 bg-blue-500/10",
  verified: "text-primary bg-primary/10",
  processing: "text-amber-300 bg-amber-500/10",
  delivered: "text-primary bg-primary/15",
  completed: "text-foreground bg-surface-elevated",
  cancelled: "text-muted-foreground bg-surface-elevated",
  refunded: "text-muted-foreground bg-surface-elevated",
  disputed: "text-destructive bg-destructive/10",
};

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.max(1, Math.floor(diff))}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function shortId(uuid: string): string {
  return "VLT-" + uuid.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export function useOrders() {
  return useQuery({
    queryKey: ["admin", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, products(name), product_offers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["admin", "order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, products(name), product_offers(name, duration), payment_receipts(*), profiles(full_name, phone)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name), product_offers(id, stock)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOffers() {
  return useQuery({
    queryKey: ["admin", "offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_offers")
        .select("*, products(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*, products(id)")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCoupons() {
  return useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReceipts() {
  return useQuery({
    queryKey: ["admin", "receipts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_receipts")
        .select("*, orders(id, order_number, total_usd, total_dzd, payment_method, products(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: ["admin", "audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useExchangeRates() {
  return useQuery({
    queryKey: ["admin", "exchange-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rate")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ["admin", "payment-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .order("display_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["admin", "customers"],
    queryFn: async () => {
      const [profilesRes, ordersRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("orders").select("user_id, total_usd, status"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (ordersRes.error) throw ordersRes.error;
      const stats = new Map<string, { orders: number; spent: number }>();
      for (const o of ordersRes.data ?? []) {
        const cur = stats.get(o.user_id) ?? { orders: 0, spent: 0 };
        cur.orders += 1;
        cur.spent += Number(o.total_usd);
        stats.set(o.user_id, cur);
      }
      return (profilesRes.data ?? []).map((p) => ({
        ...p,
        orders: stats.get(p.id)?.orders ?? 0,
        spent: stats.get(p.id)?.spent ?? 0,
      }));
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["admin", "dashboard-stats"],
    queryFn: async () => {
      const [ordersRes, rateRes] = await Promise.all([
        supabase.from("orders").select("total_usd, total_dzd, status, payment_status, created_at"),
        supabase.from("exchange_rate").select("rate").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const orders = ordersRes.data ?? [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = orders.filter((o) => new Date(o.created_at) >= today);
      const usd = orders.reduce((s, o) => s + Number(o.total_usd), 0);
      const dzd = orders.reduce((s, o) => s + Number(o.total_dzd), 0);
      const pending = orders.filter((o) => ["pending", "submitted"].includes(o.payment_status)).length;
      const processing = orders.filter((o) => o.status === "processing").length;
      const completed = orders.filter((o) => o.status === "completed").length;
      return {
        usd,
        dzd,
        ordersToday: todayOrders.length,
        pending,
        processing,
        completed,
        rate: rateRes.data?.rate ?? DEFAULT_EXCHANGE_RATE,
      };
    },
  });
}
