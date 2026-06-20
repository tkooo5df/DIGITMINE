import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendOrderNotification } from "./telegram.server";
import { DEFAULT_EXCHANGE_RATE } from "./constants";
import { tryDecrementOfferStock, adjustOfferStock } from "./stock.server";

export const getActivePaymentMethods = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("payment_methods")
      .select("id, method, display_name, account_info, instructions, qr_code_url")
      .eq("active", true);
    if (error) {
      console.error("[getActivePaymentMethods] error:", error);
      throw error;
    }
    return data ?? [];
  });


export const createSiteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      productId: z.string().uuid(),
      offerId: z.string().uuid(),
      quantity: z.number().int().min(1).max(99),
      paymentMethod: z.string().min(1).max(50),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: offer, error: offerError } = await supabaseAdmin
      .from("product_offers")
      .select("id, product_id, name, price_usd, price_dzd, delivery_type, stock, products(name, delivery_type)")
      .eq("id", data.offerId)
      .eq("product_id", data.productId)
      .eq("active", true)
      .maybeSingle();
    if (offerError) throw offerError;
    if (!offer) throw new Error("Offer not found");
    if ((offer.stock ?? 0) < data.quantity) throw new Error("Out of stock");

    const { data: method } = await supabaseAdmin
      .from("payment_methods")
      .select("method, display_name")
      .eq("method", data.paymentMethod as any)
      .eq("active", true)
      .maybeSingle();
    if (!method) throw new Error("Payment method not found");

    const { data: rateRow } = await supabaseAdmin
      .from("exchange_rate")
      .select("rate")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const rate = Number(rateRow?.rate ?? DEFAULT_EXCHANGE_RATE);
    const unitDzd = Number(offer.price_dzd ?? Number(offer.price_usd ?? 0) * rate);
    const unitUsd = Number(offer.price_usd ?? (unitDzd / rate).toFixed(2));
    const totalDzd = unitDzd * data.quantity;
    const totalUsd = Number((unitUsd * data.quantity).toFixed(2));

    const stockResult = await tryDecrementOfferStock(data.offerId, data.quantity);
    if (!stockResult.ok) throw new Error(stockResult.error);

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: context.userId,
        product_id: data.productId,
        offer_id: data.offerId,
        quantity: data.quantity,
        unit_price_usd: unitUsd,
        total_usd: totalUsd,
        total_dzd: totalDzd,
        exchange_rate_used: rate,
        payment_method: data.paymentMethod as any,
        delivery_type: (offer.delivery_type ?? (offer.products as any)?.delivery_type ?? "manual") as any,
      })
      .select("id")
      .single();
    if (orderError) {
      await adjustOfferStock(data.offerId, data.quantity);
      throw orderError;
    }

    await supabaseAdmin.from("order_messages").insert({
      order_id: order.id,
      sender_id: context.userId,
      is_admin: false,
      internal_note: false,
      body: `🛒 طلب جديد\n• المنتج: ${(offer.products as any)?.name ?? ""}\n• ${offer.name}\n• ×${data.quantity}\n• ${totalDzd.toLocaleString()} DA\n• ${method.display_name}`,
    });

    await supabaseAdmin.from("notifications").insert({
      type: "order_created",
      title: "طلب جديد",
      body: `${(offer.products as any)?.name ?? ""} ×${data.quantity} — ${totalDzd.toLocaleString()} DA`,
      link: "/admin/chats",
    });

    await sendOrderNotification(order.id);
    return { orderId: order.id };
  });
