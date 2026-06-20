import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Check } from "lucide-react";
import type { CatalogOffer, CatalogProduct } from "@/lib/catalog-data";
import { useServerFn } from "@tanstack/react-start";
import { createSiteOrder, getActivePaymentMethods } from "@/lib/orders.functions";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants";

type Props = {
  product: CatalogProduct;
  offer: CatalogOffer | null;
  quantity?: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function BuyFlowDialog({ product, offer, quantity = 1, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const createOrder = useServerFn(createSiteOrder);
  const fetchActiveMethods = useServerFn(getActivePaymentMethods);
  const [methodId, setMethodId] = useState<string | null>(null);
  const qty = Math.max(1, quantity);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: methods = [] } = useQuery({
    queryKey: ["payment-methods-active"],
    queryFn: () => fetchActiveMethods(),
  });

  const { data: rate } = useQuery({
    queryKey: ["exchange-rate-latest"],
    queryFn: async () => {
      const { data } = await supabase
        .from("exchange_rate")
        .select("rate")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return Number(data?.rate ?? DEFAULT_EXCHANGE_RATE);
    },
  });

  if (!offer) return null;
  const selected = methods.find((m) => m.id === methodId) ?? methods[0];
  const unitDzd = Number(offer.price_dzd ?? 0);
  const unitUsd = rate ? Number((unitDzd / rate).toFixed(2)) : 0;
  const totalDzd = unitDzd * qty;
  const totalUsd = Number((unitUsd * qty).toFixed(2));

  const createLocalMockOrder = async () => {
    if (!user) throw new Error(t("Could not create order"));

    const orderNumber = `DM-${Date.now().toString().slice(-6)}`;
    const { data: insertedOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        product_id: product.id,
        offer_id: offer.id,
        quantity: qty,
        unit_price_usd: unitUsd,
        total_usd: totalUsd,
        total_dzd: totalDzd,
        exchange_rate_used: Number(rate ?? DEFAULT_EXCHANGE_RATE),
        payment_method: selected.method as "binance" | "baridimob" | "ccp",
        payment_status: "pending",
        status: "pending",
        delivery_type: "manual",
        order_number: orderNumber,
      });

    const order = Array.isArray(insertedOrder) ? insertedOrder[0] : insertedOrder;

    if (orderError || !order?.id) {
      throw new Error(orderError?.message ?? t("Could not create order"));
    }

    await supabase.from("order_messages").insert({
      order_id: order.id,
      sender_id: user.id,
      is_admin: false,
      internal_note: false,
      body: `🛒 طلب جديد\n• المنتج: ${product.name}\n• ${offer.name}\n• ×${qty}\n• ${totalDzd.toLocaleString()} DA\n• ${selected.display_name}`,
    });

    await supabase.from("notifications").insert({
      type: "order_created",
      title: "طلب جديد",
      body: `${product.name} ×${qty} — ${totalDzd.toLocaleString()} DA`,
      link: "/admin/chats",
    });

    return order.id;
  };

  const submit = async () => {
    setError(null);
    if (!user) {
      onOpenChange(false);
      navigate({ to: "/auth" });
      return;
    }
    if (!selected) {
      setError(t("No payment methods available"));
      return;
    }
    setSubmitting(true);
    let orderId: string | null = null;
    try {
      const useRealSupabase =
        typeof window !== "undefined"
          ? localStorage.getItem("use_real_supabase") !== "false"
          : !import.meta.env.DEV;

      if (useRealSupabase) {
        const result = await createOrder({
          data: {
            productId: product.id,
            offerId: offer.id,
            quantity: qty,
            paymentMethod: selected.method,
          },
        });
        orderId = result?.orderId ?? null;
      } else {
        orderId = await createLocalMockOrder();
      }

      if (!orderId) {
        throw new Error(t("Could not create order"));
      }
    } catch (e: any) {
      setError(e?.message ?? t("Could not create order"));
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onOpenChange(false);
    navigate({ to: "/orders/$orderId/pay", params: { orderId } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{t("Confirm order")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border border-border p-4 bg-background/40">
            <p className="font-mono-label text-muted-foreground">{t("Product")}</p>
            <p className="font-display text-lg mt-1">{product.name}</p>
            <p className="text-sm text-muted-foreground mt-1">{offer.name}</p>
            <p className="font-mono-label text-muted-foreground mt-2">
              {[offer.duration, offer.warranty, offer.delivery_method].filter(Boolean).join(" · ")}
            </p>
          </div>

          <div className="border border-border p-4 bg-background/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono-label text-muted-foreground">{t("Quantity")}</p>
                <p className="font-mono mt-1">×{qty}</p>
              </div>
              <div className="text-right">
                <p className="font-mono-label text-muted-foreground">{t("Total")}</p>
                <p className="font-mono text-primary mt-1">{totalDzd.toLocaleString()} DA</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{unitDzd.toLocaleString()} × {qty}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="font-mono-label text-muted-foreground mb-2">{t("Payment method")}</p>
            <div className="space-y-2">
              {methods.map((m) => {
                const active = (methodId ?? methods[0]?.id) === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethodId(m.id)}
                    className={`w-full text-left p-3 border transition-colors flex items-center justify-between ${
                      active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="font-mono-label">{m.display_name}</span>
                    {active && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}
              {methods.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("No active payment methods")}</p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            onClick={submit}
            disabled={submitting || authLoading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-md font-mono-label hover:shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("Confirm and continue to payment")}
          </button>
          <p className="text-xs text-muted-foreground text-center">
            {t("After confirmation you'll upload payment proof")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
