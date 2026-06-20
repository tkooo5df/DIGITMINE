import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  answerCallbackQuery,
  editMessageCaption,
  editMessageText,
  sendMessage,
  sendNewAppMessage,
  sendOrEditAppMessage,
  getNavContext,
  statusKeyboard,
  isTelegramAdminActor,
  SITE_URL,
  escapeHtml,
} from "@/lib/telegram.server";
import {
  sendCategoriesList,
  sendProductsList,
  sendProductDetail,
  sendPaymentMethodsForOffer,
  sendPaymentInstructions,
  sendMyOrders,
  sendLanguagePicker,
  sendCurrencyPicker,
  sendSettings,
  sendWelcomeWithMenu,
  sendSupport,
  parseListCallback,
  nextSort,
} from "@/lib/telegram-shop.server";
import { getOfferStock } from "@/lib/stock.server";
import { handleReceiptPhoto, handleReceiptText } from "@/lib/telegram-purchase.server";
import {
  getChatPrefs,
  hasPrefs,
  setChatLanguage,
  setChatCurrency,
  t,
  isReplyMenuText,
} from "@/lib/telegram-i18n.server";

// ---------- Helpers ----------

function statusBadge(status: string) {
  if (status === "approved") return "✅ <b>تم قبول الدفع</b>";
  if (status === "rejected") return "❌ <b>تم رفض الدفع</b>";
  return "⏳ <b>بانتظار المراجعة</b>";
}

async function buildAdminCaption(receiptId: string, status: string) {
  const { data: receipt } = await supabaseAdmin
    .from("payment_receipts")
    .select(
      "id, order_id, user_id, file_path, amount_claimed, orders(order_number, quantity, total_dzd, payment_method, products(name), product_offers(name))",
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
  const isTxId = receipt.file_path?.startsWith("txid:");
  const txIdLine = isTxId ? `🔑 <b>Binance Pay ID:</b> <code>${escapeHtml(receipt.file_path.substring(5))}</code>\n` : "";

  return [
    "🧾 <b>طلب دفع</b>",
    "",
    statusBadge(status),
    "",
    txIdLine,
    `🛒 <b>المنتج:</b> ${escapeHtml(order.products?.name ?? "—")}`,
    `📦 <b>العرض:</b> ${escapeHtml(order.product_offers?.name ?? "—")}`,
    `🔢 <b>الكمية:</b> ×${order.quantity ?? 1}`,
    `💰 <b>الإجمالي:</b> ${total} DA`,
    `💳 <b>طريقة الدفع:</b> ${escapeHtml(order.payment_method ?? "—")}`,
    "",
    `👤 <b>الزبون:</b> ${escapeHtml(profile?.full_name ?? "—")}`,
    `📞 ${escapeHtml(profile?.phone ?? "—")}`,
    `🆔 <code>${escapeHtml(order.order_number ?? receipt.order_id)}</code>`,
  ].filter(Boolean).join("\n");
}

async function applyReview(receiptId: string, status: "approved" | "rejected") {
  const { data: receipt } = await supabaseAdmin
    .from("payment_receipts")
    .select("id, order_id, user_id")
    .eq("id", receiptId)
    .maybeSingle();
  if (!receipt) return null;

  await supabaseAdmin
    .from("payment_receipts")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", receiptId);

  await supabaseAdmin
    .from("orders")
    .update({
      payment_status: status,
      status: status === "approved" ? "processing" : "submitted",
    })
    .eq("id", receipt.order_id);

  await supabaseAdmin.from("order_messages").insert({
    order_id: receipt.order_id,
    sender_id: receipt.user_id,
    is_admin: true,
    internal_note: false,
    body:
      status === "approved"
        ? "✅ تم قبول الدفع. سيتم تجهيز طلبك قريباً."
        : "❌ تم رفض الدفع. يرجى التواصل أو إعادة إرسال إثبات الدفع.",
  });

  // Notify the customer via Telegram if their account is linked
  const { data: tgUser } = await supabaseAdmin
    .from("telegram_users")
    .select("chat_id")
    .eq("user_id", receipt.user_id)
    .maybeSingle();
  if (tgUser?.chat_id) {
    await sendMessage({
      chat_id: tgUser.chat_id,
      text:
        status === "approved"
          ? "✅ <b>تم قبول الدفع!</b>\nسيتم تجهيز طلبك قريباً."
          : "❌ <b>تم رفض الدفع.</b>\nيرجى مراجعة الإدارة.",
      reply_markup: { inline_keyboard: [[{ text: "📦 طلباتي", callback_data: "myorders" }]] },
    });
  }

  return receipt;
}

// ---------- Linking ----------

async function getLinkedUserId(chatId: number): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("telegram_users")
    .select("user_id")
    .eq("chat_id", chatId)
    .maybeSingle();
  return data?.user_id ?? null;
}

/**
 * Get or create a guest Supabase user for a Telegram chat.
 * If the chat is already linked → use that user.
 * Otherwise → create a headless auth user keyed by chat_id.
 */
async function getOrCreateGuestUser(chatId: number, fromUser?: any): Promise<string> {
  // 1. Already linked?
  const existing = await getLinkedUserId(chatId);
  if (existing) return existing;

  // 2. Check if we already created a guest for this chat (by profile name convention)
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("full_name", `TG Guest ${chatId}`)
    .maybeSingle();
  if (existingProfile) {
    // Re-link telegram_users in case it was lost
    await supabaseAdmin.from("telegram_users").upsert({
      chat_id: chatId,
      user_id: existingProfile.id,
      username: fromUser?.username ?? null,
      first_name: fromUser?.first_name ?? null,
      linked_at: new Date().toISOString(),
    });
    return existingProfile.id;
  }

  // 3. Create new guest auth user
  const guestEmail = `tg_${chatId}@guest.digitmine.bot`;
  const password = `tg_guest_${chatId}_${Date.now()}`;
  const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: guestEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: `TG Guest ${chatId}`,
      telegram_chat_id: chatId,
      telegram_username: fromUser?.username ?? null,
    },
  });

  if (createErr || !newUser?.user) {
    // User might already exist (race condition) — look up by email
    const { data: existingByName } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("full_name", `TG Guest ${chatId}`)
      .maybeSingle();
    if (existingByName) {
      await supabaseAdmin.from("telegram_users").upsert({
        chat_id: chatId,
        user_id: existingByName.id,
        username: fromUser?.username ?? null,
        first_name: fromUser?.first_name ?? null,
        linked_at: new Date().toISOString(),
      });
      return existingByName.id;
    }
    throw new Error(createErr?.message ?? "Failed to create guest user");
  }

  // 4. Link telegram_users
  await supabaseAdmin.from("telegram_users").upsert({
    chat_id: chatId,
    user_id: newUser.user.id,
    username: fromUser?.username ?? null,
    first_name: fromUser?.first_name ?? null,
    linked_at: new Date().toISOString(),
  });

  return newUser.user.id;
}

async function markUpdateProcessing(updateId?: number): Promise<boolean> {
  if (typeof updateId !== "number") return true;
  const { error } = await (supabaseAdmin as any)
    .from("telegram_processed_updates")
    .insert({ update_id: updateId });
  if (!error) return true;
  if (error.code === "23505") return false;
  if (error.code === "PGRST205") return true;
  console.warn("[telegram webhook] update dedupe failed", error);
  return true;
}

// ---------- Callback router ----------

async function handleCallback(cb: any) {
  const data: string = cb.data ?? "";
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const fromId = String(cb.from?.id ?? "");
  const isAdmin = isTelegramAdminActor({ chatId, fromId });

  // --- Admin-only actions (review buttons) ---
  if (data.startsWith("approve:") || data.startsWith("reject:")) {
    if (!isAdmin) {
      await answerCallbackQuery(cb.id, "غير مصرح");
      return;
    }
    const [action, receiptId] = data.split(":");
    const status: "approved" | "rejected" = action === "approve" ? "approved" : "rejected";
    const receipt = await applyReview(receiptId, status);
    if (!receipt) {
      await answerCallbackQuery(cb.id, "لم يتم العثور على الفاتورة");
      return;
    }
    if (chatId && messageId) {
      const { data: receipt } = await supabaseAdmin
        .from("payment_receipts")
        .select("file_path")
        .eq("id", receiptId)
        .maybeSingle();
      const isTxId = receipt?.file_path?.startsWith("txid:");

      if (isTxId) {
        await editMessageText({
          chat_id: chatId,
          message_id: messageId,
          text: await buildAdminCaption(receiptId, status),
          reply_markup: { inline_keyboard: statusKeyboard(`${SITE_URL}/admin/chats`) },
        });
      } else {
        await editMessageCaption({
          chat_id: chatId,
          message_id: messageId,
          caption: await buildAdminCaption(receiptId, status),
          reply_markup: { inline_keyboard: statusKeyboard(`${SITE_URL}/admin/chats`) },
        });
      }
    }
    await answerCallbackQuery(cb.id, status === "approved" ? "تم القبول" : "تم الرفض");
    return;
  }

  if (data.startsWith("note:")) {
    if (!isAdmin) {
      await answerCallbackQuery(cb.id, "غير مصرح");
      return;
    }
    const [, receiptId, orderId] = data.split(":");
    await supabaseAdmin.from("telegram_admin_state").upsert({
      chat_id: chatId,
      awaiting_note_order_id: orderId,
      awaiting_note_receipt_id: receiptId,
      updated_at: new Date().toISOString(),
    });
    await sendMessage({
      chat_id: chatId,
      text: "📝 أرسل الآن نص الملاحظة وسيتم إضافتها للمحادثة.",
      reply_to_message_id: messageId,
    });
    await answerCallbackQuery(cb.id, "في انتظار الملاحظة…");
    return;
  }

  // --- Customer shopping actions ---
  await answerCallbackQuery(cb.id);

  // Language / currency pickers
  if (data === "noop") return;

  if (data.startsWith("lang:")) {
    const lang = data.split(":")[1] === "en" ? "en" : "ar";
    await setChatLanguage(chatId, lang);
    const prefs = await getChatPrefs(chatId);
    await sendCurrencyPicker(chatId, prefs, messageId);
    return;
  }

  if (data.startsWith("cur:")) {
    const cur = data.split(":")[1] === "USD" ? "USD" : "DZD";
    await setChatCurrency(chatId, cur);
    const prefs = await getChatPrefs(chatId);
    const L = prefs.language;
    const confirmText = cur === "USD" ? t("currency_selected_usd", L) : t("currency_selected_dzd", L);
    await sendOrEditAppMessage({
      chat_id: chatId,
      message_id: messageId,
      text: confirmText,
    });
    await sendWelcomeWithMenu(chatId, prefs);
    await sendCategoriesList(chatId, undefined, true);
    return;
  }

  if (data === "settings") {
    const prefs = await getChatPrefs(chatId);
    await sendSettings(chatId, prefs, messageId);
    return;
  }
  if (data === "setlang") {
    await sendLanguagePicker(chatId, messageId);
    return;
  }
  if (data === "setcur") {
    const prefs = await getChatPrefs(chatId);
    await sendCurrencyPicker(chatId, prefs, messageId);
    return;
  }

  if (data === "home") {
    await sendCategoriesList(chatId, messageId);
    return;
  }

  if (data === "browse") {
    await sendCategoriesList(chatId, messageId);
    return;
  }

  if (data.startsWith("refresh:")) {
    const parsed = parseListCallback(data.replace("refresh:", ""));
    if (parsed) {
      await sendProductsList(chatId, parsed.categoryId, parsed.page, messageId, parsed.sort);
    }
    return;
  }

  if (data.startsWith("sort:")) {
    const rest = data.replace("sort:", "");
    const parts = rest.split(":");
    const currentSort = (parts.pop() as "all" | "price" | "popular") || "all";
    const parsed = parseListCallback(parts.join(":"));
    if (parsed) {
      await sendProductsList(chatId, parsed.categoryId, parsed.page, messageId, nextSort(currentSort));
    }
    return;
  }

  if (data === "back:list") {
    const nav = getNavContext(chatId);
    await sendProductsList(chatId, nav.categoryId, nav.page, messageId, nav.sort);
    return;
  }

  if (data === "back:prod") {
    const nav = getNavContext(chatId);
    if (nav.productId) {
      await sendProductDetail(chatId, nav.productId, messageId);
      return;
    }
    await sendCategoriesList(chatId, messageId);
    return;
  }

  if (data.startsWith("back:")) {
    await sendCategoriesList(chatId, messageId);
    return;
  }

  if (data.startsWith("cat:")) {
    const parsed = parseListCallback(data);
    if (parsed) {
      await sendProductsList(chatId, parsed.categoryId, parsed.page, messageId, parsed.sort);
    }
    return;
  }

  if (data.startsWith("all:")) {
    const parsed = parseListCallback(data);
    if (parsed) {
      await sendProductsList(chatId, null, parsed.page, messageId, parsed.sort);
    }
    return;
  }

  if (data.startsWith("prod:")) {
    const productId = data.split(":")[1];
    await sendProductDetail(chatId, productId, messageId);
    return;
  }

  if (data.startsWith("offer:")) {
    const offerId = data.split(":")[1];
    await sendPaymentMethodsForOffer(chatId, offerId, messageId);
    return;
  }

  if (data.startsWith("pay:")) {
    const [, offerId, method] = data.split(":");
    await sendPaymentInstructions(chatId, offerId, method, messageId);
    return;
  }

  if (data.startsWith("paid:")) {
    const [, offerId, method] = data.split(":");
    const prefs = await getChatPrefs(chatId);
    const L = prefs.language;
    try {
      const stock = await getOfferStock(offerId);
      if (stock <= 0) {
        await sendOrEditAppMessage({ chat_id: chatId, message_id: messageId, text: t("stock_out_error", L) });
        return;
      }
      const userId = await getOrCreateGuestUser(chatId, cb.from);
      await supabaseAdmin.from("telegram_admin_state").upsert({
        chat_id: chatId,
        awaiting_receipt_offer_id: offerId,
        awaiting_receipt_payment_method: method,
        awaiting_receipt_quantity: 1,
        app_message_id: messageId,
        updated_at: new Date().toISOString(),
      });
      const prompt = method === "binance" ? t("send_txid_now", L) : t("send_receipt_now", L);
      await sendOrEditAppMessage({ chat_id: chatId, message_id: messageId, text: prompt });
    } catch (err) {
      await sendOrEditAppMessage({ chat_id: chatId, message_id: messageId, text: `❌ ${(err as any)?.message ?? 'Error'}` });
    }
    return;
  }



  if (data === "myorders") {
    const prefs = await getChatPrefs(chatId);
    const userId = await getLinkedUserId(chatId);
    if (!userId) {
      await sendOrEditAppMessage({ chat_id: chatId, message_id: messageId, text: t("no_orders", prefs.language) });
      return;
    }
    await sendMyOrders(chatId, userId, messageId);
    return;
  }
}

// ---------- Message handler ----------

async function handleMessage(msg: any) {
  const chatId = msg.chat?.id;
  if (!chatId) return;
  const text: string | undefined = msg.text;
  const isAdmin = isTelegramAdminActor({ chatId });

  // 1) Photo upload — receipt submission
  if (msg.photo && Array.isArray(msg.photo) && msg.photo.length) {
    const { data: state } = await supabaseAdmin
      .from("telegram_admin_state")
      .select("awaiting_receipt_offer_id, awaiting_receipt_payment_method, app_message_id")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (!state?.awaiting_receipt_offer_id || !state.awaiting_receipt_payment_method) {
      await sendOrEditAppMessage({
        chat_id: chatId,
        text: "📸 لاستخدام صورة كوصل دفع، اختر منتجاً وطريقة دفع أولاً.",
        reply_markup: {
          inline_keyboard: [[{ text: "🛍️ تصفح المنتجات", callback_data: "browse" }]],
        },
      });
      return;
    }
    if (state.awaiting_receipt_payment_method === "binance") {
      const prefs = await getChatPrefs(chatId);
      await sendOrEditAppMessage({
        chat_id: chatId,
        message_id: state.app_message_id ? Number(state.app_message_id) : undefined,
        text: t("binance_no_photo", prefs.language),
      });
      return;
    }
    let userId: string;
    try {
      userId = await getOrCreateGuestUser(chatId, msg.from);
    } catch {
      await sendOrEditAppMessage({ chat_id: chatId, text: "❌ تعذّر إنشاء الحساب." });
      return;
    }
    // Pick highest resolution
    const best = msg.photo[msg.photo.length - 1];
    const result = await handleReceiptPhoto({
      chatId,
      userId,
      offerId: state.awaiting_receipt_offer_id,
      paymentMethod: state.awaiting_receipt_payment_method,
      fileId: best.file_id,
      appMessageId: state.app_message_id ? Number(state.app_message_id) : undefined,
    });
    if (!result.ok) {
      await sendOrEditAppMessage({ chat_id: chatId, text: `❌ تعذّر إنشاء الطلب: ${result.error ?? ""}` });
    }
    await supabaseAdmin
      .from("telegram_admin_state")
      .update({
        awaiting_receipt_offer_id: null,
        awaiting_receipt_payment_method: null,
        updated_at: new Date().toISOString(),
      })
      .eq("chat_id", chatId);
    return;
  }

  if (!text) return;

  // 1.5) Awaiting receipt Binance Pay Transaction ID
  if (!text.startsWith("/")) {
    const { data: state } = await supabaseAdmin
      .from("telegram_admin_state")
      .select("awaiting_receipt_offer_id, awaiting_receipt_payment_method, app_message_id")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (state?.awaiting_receipt_offer_id && state.awaiting_receipt_payment_method === "binance") {
      let userId: string;
      try {
        userId = await getOrCreateGuestUser(chatId, msg.from);
      } catch {
        await sendOrEditAppMessage({ chat_id: chatId, text: "❌ تعذّر إنشاء الحساب." });
        return;
      }
      const result = await handleReceiptText({
        chatId,
        userId,
        offerId: state.awaiting_receipt_offer_id,
        paymentMethod: state.awaiting_receipt_payment_method,
        transactionId: text.trim(),
        appMessageId: state.app_message_id ? Number(state.app_message_id) : undefined,
      });
      if (!result.ok) {
        await sendOrEditAppMessage({
          chat_id: chatId,
          text: `❌ <b>فشل التحقق من المعاملة:</b>\n${result.error ?? ""}\n\nيرجى التحقق من معرف الدفع وإعادة إرساله المحاولة.`,
        });
        // Do not reset the awaiting state, allowing the customer to type the correct ID
        return;
      }
      await supabaseAdmin
        .from("telegram_admin_state")
        .update({
          awaiting_receipt_offer_id: null,
          awaiting_receipt_payment_method: null,
          updated_at: new Date().toISOString(),
        })
        .eq("chat_id", chatId);
      return;
    }
  }

  // 2) Admin awaiting note text
  if (isAdmin) {
    const { data: state } = await supabaseAdmin
      .from("telegram_admin_state")
      .select("awaiting_note_order_id, awaiting_note_receipt_id")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (state?.awaiting_note_order_id) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("user_id")
        .eq("id", state.awaiting_note_order_id)
        .maybeSingle();
      if (order) {
        await supabaseAdmin.from("order_messages").insert({
          order_id: state.awaiting_note_order_id,
          sender_id: order.user_id,
          is_admin: true,
          internal_note: false,
          body: `📝 ملاحظة من الإدارة:\n${text}`,
        });
        await supabaseAdmin
          .from("telegram_admin_state")
          .update({
            awaiting_note_order_id: null,
            awaiting_note_receipt_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("chat_id", chatId);
        await sendMessage({ chat_id: chatId, text: "✅ تمت إضافة الملاحظة للمحادثة." });
        return;
      }
    }
  }

  // 3) Reply keyboard menu (sends NEW app message)
  if (text && !text.startsWith("/")) {
    const prefs = await getChatPrefs(chatId);
    if (isReplyMenuText(text, prefs.language)) {
      if (text === t("rk_products", prefs.language)) {
        await sendCategoriesList(chatId, undefined, true);
        return;
      }
      if (text === t("rk_support", prefs.language)) {
        await sendSupport(chatId, undefined, true);
        return;
      }
      if (text === t("rk_orders", prefs.language)) {
        const userId = await getLinkedUserId(chatId);
        if (!userId) {
          await sendNewAppMessage({ chat_id: chatId, text: t("no_orders", prefs.language) });
          return;
        }
        await sendMyOrders(chatId, userId, undefined, true);
        return;
      }
      if (text === t("rk_settings", prefs.language)) {
        await sendSettings(chatId, prefs, undefined, true);
        return;
      }
      if (text === t("rk_site", prefs.language)) {
        await sendMessage({
          chat_id: chatId,
          text: `🌐 <a href="${SITE_URL}">${SITE_URL}</a>`,
        });
        return;
      }
    }
  }

  // 4) Commands
  if (text.startsWith("/id")) {
    await sendMessage({ chat_id: chatId, text: `Chat ID: <code>${chatId}</code>` });
    return;
  }
  if (text.startsWith("/products") || text.startsWith("/shop")) {
    await sendCategoriesList(chatId, undefined, true);
    return;
  }
  if (text.startsWith("/orders")) {
    const userId = await getLinkedUserId(chatId);
    if (!userId) {
      const prefs = await getChatPrefs(chatId);
      await sendOrEditAppMessage({ chat_id: chatId, text: t("no_orders", prefs.language) });
      return;
    }
    await sendMyOrders(chatId, userId);
    return;
  }
  if (text.startsWith("/start") || text === "/menu") {
    if (!(await hasPrefs(chatId))) {
      await sendLanguagePicker(chatId);
      return;
    }
    const prefs = await getChatPrefs(chatId);
    await sendWelcomeWithMenu(chatId, prefs);
    await sendCategoriesList(chatId, undefined, true);
    return;
  }
  if (text.startsWith("/language") || text.startsWith("/lang")) {
    await sendLanguagePicker(chatId);
    return;
  }
  if (text.startsWith("/currency")) {
    const prefs = await getChatPrefs(chatId);
    await sendCurrencyPicker(chatId, prefs);
    return;
  }

  // Unknown text: stay silent to avoid spamming the welcome menu.
  // Users can tap /start or /menu to reopen the menu.
}

export const Route = createFileRoute("/api/public/telegram-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const update = await request.json();
          if (!(await markUpdateProcessing(update.update_id))) {
            return new Response("ok");
          }
          if (update.callback_query) {
            await handleCallback(update.callback_query);
          } else if (update.message) {
            await handleMessage(update.message);
          }
        } catch (e) {
          console.error("[telegram webhook] error", e);
        }
        return new Response("ok");
      },
      GET: async () => new Response("telegram webhook ok"),
    },
  },
});
