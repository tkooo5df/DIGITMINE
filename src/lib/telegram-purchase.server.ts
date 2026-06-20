// Create a real order + receipt from a Telegram chat photo upload.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  downloadTelegramFile,
  escapeHtml,
  getFile,
  sendOrEditAppMessage,
  sendReceiptNotification,
  SITE_URL,
} from "./telegram.server";
import { uploadReceiptBytes } from "./receipt-storage.server";
import { DEFAULT_EXCHANGE_RATE } from "./constants";
import { verifyBinanceTransaction } from "./binance.server";
import { tryDecrementOfferStock, adjustOfferStock } from "./stock.server";

async function adjustOfferStockAfterFailure(offerId: string) {
  await adjustOfferStock(offerId, 1);
}

export async function getExchangeRate(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("exchange_rate")
    .select("rate")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.rate ?? DEFAULT_EXCHANGE_RATE);
}

/**
 * Handle a customer's "I paid" photo submission.
 * - Downloads the photo from Telegram
 * - Uploads to receipts bucket
 * - Creates orders + payment_receipts rows
 * - Notifies admin (same template as the website flow)
 */
export async function handleReceiptPhoto(args: {
  chatId: number;
  userId: string;
  offerId: string;
  paymentMethod: string;
  fileId: string;
  appMessageId?: number;
}): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const { chatId, userId, offerId, paymentMethod, fileId, appMessageId } = args;

  // Load offer + product
  const { data: offer } = await supabaseAdmin
    .from("product_offers")
    .select("id, product_id, name, price_usd, price_dzd, delivery_type, stock, products(name, delivery_type)")
    .eq("id", offerId)
    .eq("active", true)
    .maybeSingle();
  if (!offer) return { ok: false, error: "Offer not found" };
  if ((offer.stock ?? 0) <= 0) return { ok: false, error: "Out of stock" };

  const rate = await getExchangeRate();
  const unitUsd = Number(offer.price_usd);
  const totalUsd = unitUsd;
  const totalDzd = Number(offer.price_dzd ?? unitUsd * rate);

  const stockResult = await tryDecrementOfferStock(offer.id, 1);
  if (!stockResult.ok) return { ok: false, error: stockResult.error };

  // Create order
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: userId,
      product_id: offer.product_id,
      offer_id: offer.id,
      quantity: 1,
      unit_price_usd: unitUsd,
      total_usd: totalUsd,
      total_dzd: totalDzd,
      exchange_rate_used: rate,
      payment_method: paymentMethod as any,
      payment_status: "submitted",
      status: "submitted",
      delivery_type: (offer.delivery_type ?? (offer.products as any)?.delivery_type ?? "manual") as any,
    })
    .select("id, order_number")
    .single();
  if (orderErr || !order) {
    console.error("[bot/purchase] order insert failed", orderErr);
    await adjustOfferStockAfterFailure(offer.id);
    return { ok: false, error: orderErr?.message };
  }

  // Download Telegram photo
  let bytes: ArrayBuffer;
  try {
    const f = await getFile(fileId);
    bytes = await downloadTelegramFile(f.file_path);
  } catch (e) {
    console.error("[bot/purchase] file download failed", e);
    return { ok: false, error: "Failed to download photo" };
  }

  const ext = "jpg";
  const path = `${userId}/${order.id}-${Date.now()}.${ext}`;
  try {
    await uploadReceiptBytes({
      objectKey: path,
      body: bytes,
      contentType: "image/jpeg",
    });
  } catch (upErr) {
    console.error("[bot/purchase] upload failed", upErr);
    return { ok: false, error: upErr instanceof Error ? upErr.message : "Upload failed" };
  }

  const { data: receipt, error: recErr } = await supabaseAdmin
    .from("payment_receipts")
    .insert({
      order_id: order.id,
      user_id: userId,
      file_path: path,
      amount_claimed: totalDzd,
      status: "submitted",
    })
    .select("id")
    .single();
  if (recErr || !receipt) {
    console.error("[bot/purchase] receipt insert failed", recErr);
    return { ok: false, error: recErr?.message };
  }

  // Notify admin
  await sendReceiptNotification(receipt.id);

  // Confirm to user
  await sendOrEditAppMessage({
    chat_id: chatId,
    message_id: appMessageId,
    text: [
      "✅ <b>تم استلام طلبك بنجاح!</b>",
      "",
      `🆔 رقم الطلب: <code>${escapeHtml(order.order_number)}</code>`,
      `🛒 ${escapeHtml((offer.products as any)?.name ?? "")} — ${escapeHtml(offer.name)}`,
      `💰 الإجمالي: <b>${Number(totalDzd).toLocaleString()} DA</b>`,
      "",
      "⏳ بانتظار مراجعة الإدارة. سيصلك إشعار فور التأكيد.",
    ].join("\n"),
    reply_markup: {
      inline_keyboard: [
        [{ text: "📦 طلباتي", callback_data: "myorders" }],
        [{ text: "🌐 متابعة على الموقع", url: `${SITE_URL}/account` }],
      ],
    },
  });

  return { ok: true, orderId: order.id };
}

import { getChatPrefs } from "./telegram-i18n.server";

/**
 * Handle a customer's Binance Pay Transaction ID text submission.
 */
export async function handleReceiptText(args: {
  chatId: number;
  userId: string;
  offerId: string;
  paymentMethod: string;
  transactionId: string;
  appMessageId?: number;
}): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const { chatId, userId, offerId, paymentMethod, transactionId, appMessageId } = args;

  // Load offer + product
  const { data: offer } = await supabaseAdmin
    .from("product_offers")
    .select("id, product_id, name, price_usd, price_dzd, delivery_type, stock, products(name, delivery_type)")
    .eq("id", offerId)
    .eq("active", true)
    .maybeSingle();
  if (!offer) return { ok: false, error: "Offer not found" };
  if ((offer.stock ?? 0) <= 0) return { ok: false, error: "Out of stock" };

  const rate = await getExchangeRate();
  const unitUsd = Number(offer.price_usd);
  const totalUsd = unitUsd;
  const totalDzd = Number(offer.price_dzd ?? unitUsd * rate);

  // Get chat language preference for verification error messages
  const prefs = await getChatPrefs(chatId);
  const locale = prefs.language || "ar";

  // Call verifyBinanceTransaction
  const verifyResult = await verifyBinanceTransaction(transactionId, totalUsd, locale);
  
  if (!verifyResult.ok) {
    return { ok: false, error: verifyResult.message };
  }

  const stockResult = await tryDecrementOfferStock(offer.id, 1);
  if (!stockResult.ok) return { ok: false, error: stockResult.error };

  const status = "approved";

  // Create order
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: userId,
      product_id: offer.product_id,
      offer_id: offer.id,
      quantity: 1,
      unit_price_usd: unitUsd,
      total_usd: totalUsd,
      total_dzd: totalDzd,
      exchange_rate_used: rate,
      payment_method: paymentMethod as any,
      payment_status: status,
      status: "processing",
      delivery_type: (offer.delivery_type ?? (offer.products as any)?.delivery_type ?? "manual") as any,
    })
    .select("id, order_number")
    .single();
  if (orderErr || !order) {
    console.error("[bot/purchase] order insert failed", orderErr);
    await adjustOfferStockAfterFailure(offer.id);
    return { ok: false, error: orderErr?.message };
  }

  // Instead of uploading file, we store "txid:<id>" in file_path
  const path = `txid:${transactionId}`;

  const { data: receipt, error: recErr } = await supabaseAdmin
    .from("payment_receipts")
    .insert({
      order_id: order.id,
      user_id: userId,
      file_path: path,
      amount_claimed: totalDzd,
      status: status,
    })
    .select("id")
    .single();
  if (recErr || !receipt) {
    console.error("[bot/purchase] receipt insert failed", recErr);
    return { ok: false, error: recErr?.message };
  }

  // Insert chat message for audit / UI
  const verifyMessage = `✅ Automated verification succeeded: Payment verified via Binance Pay API.`;

  await supabaseAdmin.from("order_messages").insert({
    order_id: order.id,
    sender_id: userId,
    is_admin: false,
    internal_note: false,
    body: `🔑 Binance Pay Transaction ID: ${transactionId}\n\n${verifyMessage}`,
  });

  // Notify admin
  await sendReceiptNotification(receipt.id);

  // Confirm to user
  const confirmationLines = [
    "✅ <b>تم استلام وتأكيد دفع طلبك تلقائياً بنجاح!</b>",
    "",
    `🆔 رقم الطلب: <code>${escapeHtml(order.order_number)}</code>`,
    `🛒 ${escapeHtml((offer.products as any)?.name ?? "")} — ${escapeHtml(offer.name)}`,
    `💰 الإجمالي: <b>${Number(totalDzd).toLocaleString()} DA</b>`,
    `🔑 معرف الدفع: <code>${escapeHtml(transactionId)}</code>`,
    "",
    "⚡ تم التحقق من الدفع تلقائياً عبر Binance API. جاري تجهيز الطلب وتسليمه الآن.",
  ];

  await sendOrEditAppMessage({
    chat_id: chatId,
    message_id: appMessageId,
    text: confirmationLines.join("\n"),
    reply_markup: {
      inline_keyboard: [
        [{ text: "📦 طلباتي", callback_data: "myorders" }],
        [{ text: "🌐 متابعة على الموقع", url: `${SITE_URL}/account` }],
      ],
    },
  });

  return { ok: true, orderId: order.id };
}
