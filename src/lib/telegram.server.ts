// Server-only Telegram Bot API helpers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getReceiptAccessUrl } from "./receipt-storage.server";

const API = (token: string) => `https://api.telegram.org/bot${token}`;
const FILE_API = (token: string) => `https://api.telegram.org/file/bot${token}`;

export const SITE_URL = process.env.SITE_URL || "https://vault-digital-lux.fly.dev";

export type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; web_app: { url: string } };

export type InlineKeyboard = InlineButton[][];

export type ReplyKeyboard = {
  keyboard: { text: string }[][];
  resize_keyboard?: boolean;
  is_persistent?: boolean;
  one_time_keyboard?: boolean;
};

async function call<T = any>(method: string, body: any): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");
  const res = await fetch(`${API(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: any = await res.json();
  if (!json.ok) {
    console.error(`[telegram] ${method} failed`, json);
    throw new Error(json.description ?? `Telegram ${method} failed`);
  }
  return json.result as T;
}

export function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

export function buildReviewKeyboard(
  receiptId: string,
  orderId: string,
  chatUrl: string,
  receiptUrl?: string,
): InlineKeyboard {
  const keyboard: InlineKeyboard = [
    [
      { text: "✅ قبول الدفع", callback_data: `approve:${receiptId}` },
      { text: "❌ رفض الدفع", callback_data: `reject:${receiptId}` },
    ],
    [
      { text: "📝 إضافة ملاحظة", callback_data: `note:${receiptId}:${orderId}` },
      { text: "💬 فتح المحادثة", url: chatUrl },
    ],
  ];
  if (receiptUrl) keyboard.splice(1, 0, [{ text: "🧾 فتح الوصل", url: receiptUrl }]);
  return keyboard;
}

export function statusKeyboard(chatUrl: string): InlineKeyboard {
  return [[{ text: "💬 فتح المحادثة", url: chatUrl }]];
}

function orderKeyboard(chatUrl: string): InlineKeyboard {
  return [[{ text: "💬 فتح المحادثة", url: chatUrl }]];
}

export async function sendPhoto(args: {
  chat_id: number | string;
  photo: string;
  caption: string;
  reply_markup?: { inline_keyboard: InlineKeyboard };
}): Promise<{ message_id: number; chat: { id: number } }> {
  return call("sendPhoto", { parse_mode: "HTML", ...args });
}

export async function sendMessage(args: {
  chat_id: number | string;
  text: string;
  reply_markup?: any;
  reply_to_message_id?: number;
  disable_web_page_preview?: boolean;
}) {
  return call("sendMessage", { parse_mode: "HTML", ...args });
}

export async function rememberAppMessage(chatId: number | string, messageId: number) {
  await (supabaseAdmin as any).from("telegram_admin_state").upsert({
    chat_id: Number(chatId),
    app_message_id: messageId,
    updated_at: new Date().toISOString(),
  });
}

export type NavContext = {
  categoryId: string | null;
  page: number;
  sort: "all" | "price" | "popular";
  productId?: string | null;
};

/** In-memory nav stack per chat (bot UI only — no DB schema changes). */
const navByChat = new Map<number, NavContext>();

export function rememberNavContext(chatId: number | string, nav: NavContext) {
  navByChat.set(Number(chatId), nav);
}

export function getNavContext(chatId: number | string): NavContext {
  return navByChat.get(Number(chatId)) ?? { categoryId: null, page: 0, sort: "all", productId: null };
}

export async function getAppMessageId(chatId: number | string): Promise<number | null> {
  const { data } = await (supabaseAdmin as any)
    .from("telegram_admin_state")
    .select("app_message_id")
    .eq("chat_id", Number(chatId))
    .maybeSingle();
  return data?.app_message_id ? Number(data.app_message_id) : null;
}

/** Send a fresh app panel message (used when opening from the reply keyboard menu). */
export async function sendNewAppMessage(args: {
  chat_id: number | string;
  text: string;
  reply_markup?: { inline_keyboard: InlineKeyboard };
  disable_web_page_preview?: boolean;
}) {
  const sent = await sendMessage({
    chat_id: args.chat_id,
    text: args.text,
    reply_markup: args.reply_markup,
    disable_web_page_preview: args.disable_web_page_preview,
  }) as { message_id?: number };
  if (sent?.message_id) await rememberAppMessage(args.chat_id, sent.message_id);
  return sent;
}

export async function sendOrEditAppMessage(args: {
  chat_id: number | string;
  text: string;
  reply_markup?: { inline_keyboard: InlineKeyboard };
  message_id?: number | null;
  disable_web_page_preview?: boolean;
}) {
  const targetId = args.message_id ?? (await getAppMessageId(args.chat_id));

  if (targetId) {
    try {
      await editMessageText({
        chat_id: args.chat_id,
        message_id: targetId,
        text: args.text,
        reply_markup: args.reply_markup,
      });
      await rememberAppMessage(args.chat_id, targetId);
      return { message_id: targetId };
    } catch (e) {
      if (!String(e).includes("message is not modified")) {
        console.warn("[telegram] edit failed, sending new message", e);
      } else {
        return { message_id: targetId };
      }
    }
  }

  const sent = await sendMessage({
    chat_id: args.chat_id,
    text: args.text,
    reply_markup: args.reply_markup,
    disable_web_page_preview: args.disable_web_page_preview,
  }) as { message_id?: number };
  if (sent?.message_id) await rememberAppMessage(args.chat_id, sent.message_id);
  return sent;
}

export async function editMessageCaption(args: {
  chat_id: number | string;
  message_id: number;
  caption: string;
  reply_markup?: { inline_keyboard: InlineKeyboard };
}) {
  try {
    return await call("editMessageCaption", { parse_mode: "HTML", ...args });
  } catch (e) {
    console.warn("[telegram] editMessageCaption failed", e);
    return editMessageText({
      chat_id: args.chat_id,
      message_id: args.message_id,
      text: args.caption,
      reply_markup: args.reply_markup,
    });
  }
}

export async function editMessageText(args: {
  chat_id: number | string;
  message_id: number;
  text: string;
  reply_markup?: { inline_keyboard: InlineKeyboard };
}) {
  try {
    return await call("editMessageText", { parse_mode: "HTML", ...args });
  } catch (e) {
    if (String(e).includes("message is not modified")) return { ok: true } as any;
    console.warn("[telegram] editMessageText failed", e);
    throw e;
  }
}

export async function answerCallbackQuery(callback_query_id: string, text?: string) {
  try {
    return await call("answerCallbackQuery", { callback_query_id, text });
  } catch (e) {
    console.warn("[telegram] answerCallbackQuery failed", e);
  }
}

export async function getFile(file_id: string): Promise<{ file_path: string; file_size?: number }> {
  return call("getFile", { file_id });
}

export async function downloadTelegramFile(file_path: string): Promise<ArrayBuffer> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");
  const res = await fetch(`${FILE_API(token)}/${file_path}`);
  if (!res.ok) throw new Error(`Failed to download telegram file: ${res.status}`);
  return res.arrayBuffer();
}

export function getAdminChatIds(): string[] {
  const raw = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!raw) throw new Error("TELEGRAM_ADMIN_CHAT_ID missing");
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getAdminChatId(): string {
  return getAdminChatIds()[0];
}

export function isTelegramAdminActor(args: { chatId?: number | string | null; fromId?: number | string | null }) {
  const ids = new Set(getAdminChatIds());
  const chatId = args.chatId != null ? String(args.chatId) : null;
  const fromId = args.fromId != null ? String(args.fromId) : null;
  return (chatId != null && ids.has(chatId)) || (fromId != null && ids.has(fromId));
}

function statusBadge(status: string) {
  if (status === "approved") return "✅ <b>تم قبول الدفع</b>";
  if (status === "rejected") return "❌ <b>تم رفض الدفع</b>";
  return "⏳ <b>بانتظار المراجعة</b>";
}

async function buildReceiptCaption(receiptId: string, status: string): Promise<string> {
  const { data: receipt } = await supabaseAdmin
    .from("payment_receipts")
    .select(
      "id, order_id, user_id, amount_claimed, orders(order_number, quantity, total_dzd, payment_method, products(name), product_offers(name))",
    )
    .eq("id", receiptId)
    .maybeSingle();
  if (!receipt) return statusBadge(status);
  const order: any = receipt.orders ?? {};
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, phone")
    .eq("id", receipt.user_id)
    .maybeSingle();
  const total = Number(order.total_dzd ?? receipt.amount_claimed ?? 0).toLocaleString();
  return [
    "🧾 <b>طلب دفع جديد</b>",
    "",
    statusBadge(status),
    "",
    `🛒 <b>المنتج:</b> ${escapeHtml(order.products?.name ?? "—")}`,
    `📦 <b>العرض:</b> ${escapeHtml(order.product_offers?.name ?? "—")}`,
    `🔢 <b>الكمية:</b> ×${order.quantity ?? 1}`,
    `💰 <b>الإجمالي:</b> ${total} DA`,
    `💳 <b>طريقة الدفع:</b> ${escapeHtml(order.payment_method ?? "—")}`,
    "",
    `👤 <b>الزبون:</b> ${escapeHtml(profile?.full_name ?? "—")}`,
    `📞 ${escapeHtml(profile?.phone ?? "—")}`,
    `🆔 <code>${escapeHtml(order.order_number ?? receipt.order_id)}</code>`,
  ].join("\n");
}

async function buildOrderCaption(orderId: string): Promise<string> {
  const { data: orderRaw } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, user_id, quantity, total_dzd, payment_method, status, payment_status, products(name), product_offers(name)")
    .eq("id", orderId)
    .maybeSingle();
  const order: any = orderRaw;
  if (!order) return "🛒 <b>طلب جديد</b>";
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, phone")
    .eq("id", order.user_id)
    .maybeSingle();
  return [
    "🛒 <b>طلب جديد من الموقع</b>",
    "",
    `🛒 <b>المنتج:</b> ${escapeHtml(order.products?.name ?? "—")}`,
    `📦 <b>العرض:</b> ${escapeHtml(order.product_offers?.name ?? "—")}`,
    `🔢 <b>الكمية:</b> ×${order.quantity ?? 1}`,
    `💰 <b>الإجمالي:</b> ${Number(order.total_dzd ?? 0).toLocaleString()} DA`,
    `💳 <b>طريقة الدفع:</b> ${escapeHtml(order.payment_method ?? "—")}`,
    `📌 <b>الحالة:</b> ${escapeHtml(order.status)} / ${escapeHtml(order.payment_status)}`,
    "",
    `👤 <b>الزبون:</b> ${escapeHtml(profile?.full_name ?? "—")}`,
    `📞 ${escapeHtml(profile?.phone ?? "—")}`,
    `🆔 <code>${escapeHtml(order.order_number ?? order.id)}</code>`,
  ].join("\n");
}

/** Send the admin notification for a receipt. Safe to call from anywhere server-side. */
export async function sendReceiptNotification(receiptId: string): Promise<void> {
  const { data: receipt } = await (supabaseAdmin as any)
    .from("payment_receipts")
    .select("id, order_id, file_path, status, telegram_chat_id, telegram_message_id, telegram_notified_at")
    .eq("id", receiptId)
    .maybeSingle();
  if (!receipt) return;

  const isTxId = receipt.file_path?.startsWith("txid:");
  let signedUrl = "";
  if (!isTxId) {
    try {
      signedUrl = await getReceiptAccessUrl(receipt.file_path, 60 * 60 * 24 * 30);
    } catch (e) {
      console.warn("Could not get receipt access url", e);
    }
  }

  const chatUrl = `${SITE_URL}/admin/chats`;
  let caption = await buildReceiptCaption(receiptId, receipt.status ?? "submitted");
  if (isTxId) {
    const txId = receipt.file_path.substring(5);
    caption = `🔑 <b>Binance Pay ID:</b> <code>${escapeHtml(txId)}</code>\n\n` + caption;
  }
  const keyboard = buildReviewKeyboard(receipt.id, receipt.order_id, chatUrl, isTxId ? undefined : signedUrl);

  try {
    if (receipt.telegram_chat_id && receipt.telegram_message_id) {
      if (isTxId) {
        await editMessageText({
          chat_id: receipt.telegram_chat_id,
          message_id: receipt.telegram_message_id,
          text: caption,
          reply_markup: { inline_keyboard: keyboard },
        });
      } else {
        await editMessageCaption({
          chat_id: receipt.telegram_chat_id,
          message_id: receipt.telegram_message_id,
          caption,
          reply_markup: { inline_keyboard: keyboard },
        });
      }
      await (supabaseAdmin as any)
        .from("payment_receipts")
        .update({ telegram_notified_at: receipt.telegram_notified_at ?? new Date().toISOString() })
        .eq("id", receiptId);
      return;
    }

    let result;
    if (isTxId) {
      result = await sendMessage({
        chat_id: getAdminChatId(),
        text: caption,
        reply_markup: { inline_keyboard: keyboard },
      }) as { message_id: number; chat: { id: number } };
    } else {
      result = await sendPhoto({
        chat_id: getAdminChatId(),
        photo: signedUrl,
        caption,
        reply_markup: { inline_keyboard: keyboard },
      });
    }
    await (supabaseAdmin as any)
      .from("payment_receipts")
      .update({
        telegram_chat_id: result.chat.id,
        telegram_message_id: result.message_id,
        telegram_notified_at: new Date().toISOString(),
      })
      .eq("id", receiptId);
  } catch (e) {
    console.error("[telegram] sendReceiptNotification failed", e);
  }
}

export async function sendOrderNotification(orderId: string): Promise<void> {
  const { data: order } = await (supabaseAdmin as any)
    .from("orders")
    .select("id, telegram_chat_id, telegram_message_id, telegram_notified_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const chatUrl = `${SITE_URL}/admin/chats`;
  const text = await buildOrderCaption(orderId);
  const keyboard = orderKeyboard(chatUrl);

  try {
    if (order.telegram_chat_id && order.telegram_message_id) {
      await editMessageText({
        chat_id: order.telegram_chat_id,
        message_id: order.telegram_message_id,
        text,
        reply_markup: { inline_keyboard: keyboard },
      });
      await (supabaseAdmin as any)
        .from("orders")
        .update({ telegram_notified_at: order.telegram_notified_at ?? new Date().toISOString() })
        .eq("id", orderId);
      return;
    }

    const result = await sendMessage({
      chat_id: getAdminChatId(),
      text,
      reply_markup: { inline_keyboard: keyboard },
    }) as { message_id: number; chat: { id: number } };
    await (supabaseAdmin as any)
      .from("orders")
      .update({
        telegram_chat_id: result.chat.id,
        telegram_message_id: result.message_id,
        telegram_notified_at: new Date().toISOString(),
      })
      .eq("id", orderId);
  } catch (e) {
    console.error("[telegram] sendOrderNotification failed", e);
  }
}

export async function syncReceiptToTelegram(receiptId: string): Promise<void> {
  const { data: receipt } = await supabaseAdmin
    .from("payment_receipts")
    .select("id, status, file_path, telegram_chat_id, telegram_message_id")
    .eq("id", receiptId)
    .maybeSingle();
  if (!receipt?.telegram_chat_id || !receipt.telegram_message_id) return;
  const chatUrl = `${SITE_URL}/admin/chats`;
  
  const isTxId = receipt.file_path?.startsWith("txid:");
  let caption = await buildReceiptCaption(receiptId, receipt.status ?? "submitted");
  if (isTxId) {
    const txId = receipt.file_path.substring(5);
    caption = `🔑 <b>Binance Pay ID:</b> <code>${escapeHtml(txId)}</code>\n\n` + caption;
    await editMessageText({
      chat_id: receipt.telegram_chat_id,
      message_id: receipt.telegram_message_id,
      text: caption,
      reply_markup: { inline_keyboard: statusKeyboard(chatUrl) },
    });
  } else {
    await editMessageCaption({
      chat_id: receipt.telegram_chat_id,
      message_id: receipt.telegram_message_id,
      caption,
      reply_markup: { inline_keyboard: statusKeyboard(chatUrl) },
    });
  }
}
