import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendOrderNotification, sendReceiptNotification, syncReceiptToTelegram } from "./telegram.server";

export const notifyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("user_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.user_id !== context.userId) {
      throw new Error("Not allowed");
    }
    await sendOrderNotification(data.orderId);
    return { ok: true };
  });

export const notifyReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ receiptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: receipt } = await supabaseAdmin
      .from("payment_receipts")
      .select("user_id")
      .eq("id", data.receiptId)
      .maybeSingle();
    if (!receipt || receipt.user_id !== context.userId) {
      throw new Error("Not allowed");
    }
    await sendReceiptNotification(data.receiptId);
    return { ok: true };
  });

export const syncReceiptStatusToTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ receiptId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await syncReceiptToTelegram(data.receiptId);
    return { ok: true };
  });
