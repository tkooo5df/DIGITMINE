import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildReceiptObjectKey,
  createReceiptUploadTarget,
  deleteReceiptObjects,
  getReceiptAccessUrl,
} from "./receipt-storage.server";
import { verifyBinanceTransaction } from "./binance.server";
import { sendReceiptNotification } from "./telegram.server";

async function isAdminUser(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  return Boolean(data);
}

export const prepareReceiptUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      orderId: z.string().min(1),
      fileName: z.string().min(1).max(255),
      contentType: z.string().max(255).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id")
      .eq("id", data.orderId)
      .maybeSingle();

    if (!order || order.user_id !== context.userId) {
      throw new Error("Not allowed");
    }

    const objectKey = buildReceiptObjectKey({
      userId: context.userId,
      orderId: data.orderId,
      fileName: data.fileName,
    });

    return createReceiptUploadTarget({
      objectKey,
      contentType: data.contentType,
    });
  });

export const getReceiptAccessUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      receiptId: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: receipt } = await supabaseAdmin
      .from("payment_receipts")
      .select("id, user_id, file_path")
      .eq("id", data.receiptId)
      .maybeSingle();

    const isAdmin = await isAdminUser(context.userId);
    if (!receipt || (receipt.user_id !== context.userId && !isAdmin)) {
      throw new Error("Not allowed");
    }

    return {
      url: await getReceiptAccessUrl(receipt.file_path, 60 * 60 * 24),
    };
  });

export const deleteReceiptFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      receiptIds: z.array(z.string().min(1)).min(1).max(100),
    }),
  )
  .handler(async ({ data, context }) => {
    const isAdmin = await isAdminUser(context.userId);
    if (!isAdmin) {
      throw new Error("Not allowed");
    }

    const { data: receipts } = await supabaseAdmin
      .from("payment_receipts")
      .select("id, file_path")
      .in("id", data.receiptIds);

    await deleteReceiptObjects((receipts ?? []).map((receipt) => receipt.file_path));
    return { ok: true };
  });

export const submitBinanceTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      orderId: z.string().min(1),
      transactionId: z.string().min(1),
      locale: z.string().optional().default("ar"),
    }),
  )
  .handler(async ({ data, context }) => {
    // 1. Get order details
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total_dzd, total_usd, payment_method, status, payment_status, products(name), product_offers(name)")
      .eq("id", data.orderId)
      .maybeSingle();

    if (!order || order.payment_method !== "binance") {
      throw new Error("Invalid order or payment method");
    }

    const expectedUsd = Number(order.total_usd);

    // 2. Call verifyBinanceTransaction
    const verifyResult = await verifyBinanceTransaction(data.transactionId, expectedUsd, data.locale);

    if (!verifyResult.ok) {
      throw new Error(verifyResult.message);
    }

    const status = "approved";
    const path = `txid:${data.transactionId.trim()}`;

    // 3. Insert receipt
    const { data: receipt, error: recErr } = await supabaseAdmin
      .from("payment_receipts")
      .insert({
        order_id: data.orderId,
        user_id: context.userId,
        file_path: path,
        amount_claimed: Number(order.total_dzd),
        status: status,
      })
      .select("id")
      .single();

    if (recErr || !receipt) {
      throw new Error(recErr?.message ?? "Failed to save receipt");
    }

    // 4. Update order status
    await supabaseAdmin
      .from("orders")
      .update({
        payment_status: status,
        status: "processing",
      })
      .eq("id", data.orderId);

    // 5. Insert chat message
    const isAr = data.locale === "ar";
    const labels = isAr
      ? {
          proof: "إثبات الدفع",
          product: "المنتج",
          offer: "العرض",
          amount: "المبلغ",
          method: "طريقة الدفع",
          txid: "معرف دفع Binance Pay",
          verified: "✅ تم التحقق التلقائي بنجاح عبر Binance API. تم قبول الدفع تلقائياً وبدء تجهيز الطلب.",
        }
      : {
          proof: "Payment proof",
          product: "Product",
          offer: "Offer",
          amount: "Amount",
          method: "Payment method",
          txid: "Binance Pay Transaction ID",
          verified: "✅ Automated verification succeeded via Binance API. Payment approved automatically.",
        };

    await supabaseAdmin.from("order_messages").insert({
      order_id: data.orderId,
      sender_id: context.userId,
      is_admin: false,
      internal_note: false,
      body: `💳 ${labels.proof}\n• ${labels.product}: ${(order as any)?.products?.name ?? ""}\n• ${labels.offer}: ${(order as any)?.product_offers?.name ?? ""}\n• ${labels.amount}: ${Number(order.total_dzd).toLocaleString()} DA\n• ${labels.method}: ${order.payment_method}\n• ${labels.txid}: ${data.transactionId.trim()}\n\n${labels.verified}`,
    });

    // 6. Notify admin (database notification)
    await supabaseAdmin.from("notifications").insert({
      type: "payment_approved",
      title: isAr ? "تم تأكيد الدفع تلقائياً" : "Payment approved automatically",
      body: `Order ${order.order_number} — ${(order as any).products?.name}`,
      link: `/admin/chats`,
    });

    // 7. Dispatch Telegram notifications
    try {
      await sendReceiptNotification(receipt.id);
    } catch (e) {
      console.warn("Telegram notify failed", e);
    }

    return { ok: true, verified: true, message: verifyResult.message };
  });

