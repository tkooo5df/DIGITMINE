// Shop browsing helpers for the Telegram bot.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  escapeHtml,
  SITE_URL,
  sendMessage,
  sendNewAppMessage,
  sendOrEditAppMessage,
  rememberNavContext,
  getNavContext,
  type InlineKeyboard,
  type ReplyKeyboard,
} from "./telegram.server";
import { getChatPrefs, t, formatPrice, type ChatPrefs, type Lang, type Currency } from "./telegram-i18n.server";
import { getOfferStock } from "./stock.server";

const PAGE = 8;
type SortMode = "all" | "price" | "popular";

export function buildMainReplyKeyboard(L: Lang): ReplyKeyboard {
  return {
    keyboard: [
      [{ text: t("rk_products", L) }, { text: t("rk_support", L) }],
      [{ text: t("rk_orders", L) }],
      [{ text: t("rk_settings", L) }, { text: t("rk_site", L) }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

async function deliver(
  chatId: number,
  text: string,
  kb: InlineKeyboard,
  messageId?: number,
  forceNew = false,
) {
  const markup = { inline_keyboard: kb };
  if (forceNew) {
    await sendNewAppMessage({ chat_id: chatId, text, reply_markup: markup });
    return;
  }
  if (messageId) {
    await sendOrEditAppMessage({ chat_id: chatId, message_id: messageId, text, reply_markup: markup });
    return;
  }
  await sendOrEditAppMessage({ chat_id: chatId, text, reply_markup: markup });
}

export async function sendLanguagePicker(chatId: number, messageId?: number) {
  const text = "🌐 Choose your language / اختر لغتك";
  const kb: InlineKeyboard = [
    [
      { text: "🇩🇿 العربية", callback_data: "lang:ar" },
      { text: "🇬🇧 English", callback_data: "lang:en" },
    ],
  ];
  await deliver(chatId, text, kb, messageId);
}

export async function sendCurrencyPicker(chatId: number, prefs: ChatPrefs, messageId?: number) {
  const L = prefs.language;
  const text = [
    `<b>${t("pick_currency", L)}</b>`,
    "",
    `💵 USD ($)`,
    t("currency_usd_note", L),
    "",
    `🇩🇿 DZD (DA)`,
    t("currency_dzd_note", L),
  ].join("\n");
  const kb: InlineKeyboard = [
    [
      { text: "💵 USD ($)", callback_data: "cur:USD" },
      { text: "🇩🇿 DZD (DA)", callback_data: "cur:DZD" },
    ],
  ];
  await deliver(chatId, text, kb, messageId);
}

/** Payment method slug tied to display currency (bot UI routing only). */
export function paymentMethodForCurrency(currency: Currency): "binance" | "baridimob" {
  return currency === "USD" ? "binance" : "baridimob";
}

/** Send welcome text with persistent reply keyboard (bottom menu). */
export async function sendWelcomeWithMenu(chatId: number, prefs: ChatPrefs) {
  const L = prefs.language;
  const text = [
    `<b>${t("welcome_title", L)}</b>`,
    t("welcome_subtitle", L),
  ].join("\n");
  await sendMessage({
    chat_id: chatId,
    text,
    reply_markup: buildMainReplyKeyboard(L),
  });
}

export async function sendMainMenu(chatId: number, _linked: boolean, prefs: ChatPrefs, messageId?: number, forceNew = false) {
  const L = prefs.language;
  const text = `<b>${t("welcome_title", L)}</b>\n${t("welcome_subtitle", L)}`;
  const keyboard: InlineKeyboard = [
    [{ text: t("menu_browse", L), callback_data: "browse" }],
    [{ text: t("menu_orders", L), callback_data: "myorders" }],
    [{ text: t("menu_settings", L), callback_data: "settings" }],
    [{ text: t("menu_site", L), url: SITE_URL }],
  ];
  await deliver(chatId, text, keyboard, messageId, forceNew);
}

export async function sendSupport(chatId: number, messageId?: number, forceNew = false) {
  const prefs = await getChatPrefs(chatId);
  const L = prefs.language;
  const text = [t("support_title", L), "", t("support_body", L)].join("\n");
  const kb: InlineKeyboard = [
    [{ text: t("menu_site", L), url: SITE_URL }],
    [{ text: t("home_btn", L), callback_data: "home" }],
  ];
  await deliver(chatId, text, kb, messageId, forceNew);
}

export async function sendSettings(chatId: number, prefs: ChatPrefs, messageId?: number, forceNew = false) {
  const L = prefs.language;
  const paymentNote = prefs.currency === "USD" ? t("currency_usd_note", L) : t("currency_dzd_note", L);
  const text = [
    `<b>${t("settings_title", L)}</b>`,
    "",
    `🌐 ${prefs.language.toUpperCase()}`,
    `💱 ${prefs.currency}`,
    paymentNote,
  ].join("\n");
  const kb: InlineKeyboard = [
    [{ text: t("change_language", L), callback_data: "setlang" }],
    [{ text: t("change_currency", L), callback_data: "setcur" }],
    [{ text: t("home_btn", L), callback_data: "home" }],
  ];
  await deliver(chatId, text, kb, messageId, forceNew);
}

export async function sendCategoriesList(chatId: number, messageId?: number, forceNew = false) {
  const prefs = await getChatPrefs(chatId);
  const L = prefs.language;
  const { data: cats } = await supabaseAdmin
    .from("categories")
    .select("id, name")
    .eq("visible", true)
    .is("parent_id", null)
    .order("sort_order");

  const kb: InlineKeyboard = [];
  for (const c of cats ?? []) {
    kb.push([{ text: `📂 ${c.name}`, callback_data: `cat:${c.id}:0:all` }]);
  }
  kb.push([{ text: t("all_products", L), callback_data: "all:0:all" }]);
  kb.push([{ text: t("home_btn", L), callback_data: "home" }]);

  const text = `<b>${t("pick_category", L)}</b>`;
  await deliver(chatId, text, kb, messageId, forceNew);
}

type OfferInfo = {
  priceDzd: number | null;
  priceUsd: number | null;
  stock: number;
  discountPct: number | null;
  offerName: string | null;
};

async function offerInfoForProduct(productId: string): Promise<OfferInfo> {
  const { data } = await supabaseAdmin
    .from("product_offers")
    .select("name, price_dzd, price_usd, stock, discount_usd")
    .eq("product_id", productId)
    .eq("active", true)
    .order("price_dzd", { ascending: true });

  if (!data?.length) return { priceDzd: null, priceUsd: null, stock: 0, discountPct: null, offerName: null };

  const best = data[0];
  const totalStock = data.reduce((sum, o) => sum + (o.stock ?? 0), 0);
  let discountPct: number | null = null;
  if (best.discount_usd && best.price_usd) {
    const orig = Number(best.price_usd) + Number(best.discount_usd);
    if (orig > 0) discountPct = Math.round((Number(best.discount_usd) / orig) * 100);
  }

  return {
    priceDzd: best.price_dzd != null ? Number(best.price_dzd) : null,
    priceUsd: best.price_usd != null ? Number(best.price_usd) : null,
    stock: totalStock,
    discountPct,
    offerName: best.name,
  };
}

function truncateBtn(text: string, max = 60): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function formatProductBtn(name: string, info: OfferInfo, currency: ChatPrefs["currency"]): string {
  const parts: string[] = [`🛒 ${name}`];
  if (info.priceDzd || info.priceUsd) {
    parts.push(formatPrice(info.priceDzd, info.priceUsd, currency));
  }
  if (info.discountPct && info.discountPct > 0) {
    parts.push(`🔥-${info.discountPct}%`);
  }
  if (info.stock > 0) {
    parts.push(`📦${info.stock}`);
  } else {
    parts.push("🚫");
  }
  return truncateBtn(parts.join("  "));
}

function sortLabel(sort: SortMode, L: Lang): string {
  if (sort === "price") return t("sort_price", L);
  if (sort === "popular") return t("sort_popular", L);
  return t("sort_all", L);
}

function nextSort(sort: SortMode): SortMode {
  if (sort === "all") return "price";
  if (sort === "price") return "popular";
  return "all";
}

function buildListPrefix(categoryId: string | null): string {
  return categoryId ? `cat:${categoryId}` : "all";
}

function parseListCallback(data: string): { categoryId: string | null; page: number; sort: SortMode } | null {
  const parts = data.split(":");
  if (parts[0] === "all") {
    return { categoryId: null, page: Number(parts[1] || 0), sort: (parts[2] as SortMode) || "all" };
  }
  if (parts[0] === "cat") {
    return { categoryId: parts[1], page: Number(parts[2] || 0), sort: (parts[3] as SortMode) || "all" };
  }
  return null;
}

export async function sendProductsList(
  chatId: number,
  categoryId: string | null,
  page: number,
  messageId?: number,
  sort: SortMode = "all",
  forceNew = false,
) {
  const prefs = await getChatPrefs(chatId);
  const L = prefs.language;
  const prefix = buildListPrefix(categoryId);

  let countQ = supabaseAdmin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("visible", true);
  if (categoryId) countQ = countQ.eq("category_id", categoryId);
  const { count: totalCount } = await countQ;
  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  let q = supabaseAdmin
    .from("products")
    .select("id, name, sales_count")
    .eq("visible", true)
    .range(page * PAGE, page * PAGE + PAGE - 1);

  if (categoryId) q = q.eq("category_id", categoryId);

  if (sort === "price") {
    q = q.order("original_price_dzd", { ascending: true, nullsFirst: false });
  } else if (sort === "popular") {
    q = q.order("sales_count", { ascending: false });
  } else {
    q = q.order("featured", { ascending: false }).order("sales_count", { ascending: false });
  }

  const { data: products } = await q;

  const kb: InlineKeyboard = [];
  for (const p of products ?? []) {
    const info = await offerInfoForProduct(p.id);
    const label = formatProductBtn(p.name, info, prefs.currency);
    if (info.stock <= 0) {
      kb.push([{ text: `🚫 ${truncateBtn(p.name, 50)}`, callback_data: "noop" }]);
    } else {
      kb.push([{ text: label, callback_data: `prod:${p.id}` }]);
    }
  }

  // Utility row: refresh + sort
  kb.push([
    { text: t("refresh", L), callback_data: `refresh:${prefix}:${page}:${sort}` },
    { text: `${t("sort_label", L)}: ${sortLabel(sort, L)}`, callback_data: `sort:${prefix}:${page}:${sort}` },
  ]);

  // Pagination row
  const nav: InlineKeyboard[number] = [];
  if (page > 0) nav.push({ text: `⬅️ ${t("prev", L)}`, callback_data: `${prefix}:${page - 1}:${sort}` });
  nav.push({ text: `${page + 1}/${totalPages}`, callback_data: "noop" });
  if (page + 1 < totalPages) nav.push({ text: `${t("next", L)} ➡️`, callback_data: `${prefix}:${page + 1}:${sort}` });
  if (nav.length) kb.push(nav);

  kb.push([{ text: t("back_categories", L), callback_data: "browse" }]);
  kb.push([{ text: t("home_btn", L), callback_data: "home" }]);

  const text = (products?.length ?? 0) === 0
    ? t("no_products", L)
    : `${t("catalog_title", L)}\n<i>${t("catalog_page", L)} ${page + 1}/${totalPages}</i>`;

  rememberNavContext(chatId, { categoryId, page, sort });
  await deliver(chatId, text, kb, messageId, forceNew);
}

export async function sendProductDetail(
  chatId: number,
  productId: string,
  messageId?: number,
) {
  const prefs = await getChatPrefs(chatId);
  const L = prefs.language;
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id, name, short_description, main_image, rating, sales_count")
    .eq("id", productId)
    .eq("visible", true)
    .maybeSingle();
  if (!product) {
    await sendOrEditAppMessage({ chat_id: chatId, message_id: messageId, text: "❌" });
    return;
  }
  const { data: offers } = await supabaseAdmin
    .from("product_offers")
    .select("id, name, duration, price_dzd, price_usd, stock, discount_usd")
    .eq("product_id", productId)
    .eq("active", true)
    .order("sort_order");

  const lines = [
    `<b>${escapeHtml(product.name)}</b>`,
    product.short_description ? `\n${escapeHtml(product.short_description)}` : "",
    `\n⭐ ${product.rating ?? 0} • 🛒 ${product.sales_count ?? 0} ${t("purchases_count", L)}`,
    `\n\n<b>${t("offers_available", L)}</b>`,
  ];
  for (const o of offers ?? []) {
    const disc = o.discount_usd && o.price_usd
      ? ` 🔥-${Math.round((Number(o.discount_usd) / (Number(o.price_usd) + Number(o.discount_usd))) * 100)}%`
      : "";
    const stock = (o.stock ?? 0) > 0 ? ` 📦${o.stock}` : ` 🚫`;
    lines.push(
      `• ${escapeHtml(o.name)}${o.duration ? ` (${escapeHtml(o.duration)})` : ""} — <b>${formatPrice(o.price_dzd, o.price_usd, prefs.currency)}</b>${disc}${stock}`,
    );
  }
  if (!offers?.length) lines.push(t("no_offers", L));

  const kb: InlineKeyboard = [];
  for (const o of offers ?? []) {
    if ((o.stock ?? 0) <= 0) {
      kb.push([{ text: `🚫 ${o.name} — ${t("out_of_stock", L)}`, callback_data: "noop" }]);
      continue;
    }
    const price = formatPrice(o.price_dzd, o.price_usd, prefs.currency);
    kb.push([{ text: `✅ ${o.name} • ${price}`, callback_data: `offer:${o.id}` }]);
  }
  kb.push([{ text: t("back_products", L), callback_data: "back:list" }]);
  kb.push([{ text: t("home_btn", L), callback_data: "home" }]);

  const imageLink = product.main_image ? `<a href="${product.main_image}">&#8203;</a>` : "";
  const caption = imageLink + lines.join("\n");
  const nav = getNavContext(chatId);
  rememberNavContext(chatId, { ...nav, productId });
  await deliver(chatId, caption, kb, messageId);
}

export async function sendPaymentMethodsForOffer(
  chatId: number,
  offerId: string,
  messageId?: number,
) {
  const prefs = await getChatPrefs(chatId);
  const L = prefs.language;
  const stock = await getOfferStock(offerId);
  if (stock <= 0) {
    await deliver(chatId, t("stock_out_error", L), [[{ text: t("back_products", L), callback_data: "back:list" }]], messageId);
    return;
  }
  const method = paymentMethodForCurrency(prefs.currency);
  await sendPaymentInstructions(chatId, offerId, method, messageId);
}

export async function sendPaymentInstructions(
  chatId: number,
  offerId: string,
  method: string,
  messageId?: number,
) {
  const prefs = await getChatPrefs(chatId);
  const L = prefs.language;
  const { data: pm } = await supabaseAdmin
    .from("payment_methods")
    .select("display_name, instructions, account_info, qr_code_url")
    .eq("method", method as any)
    .eq("active", true)
    .maybeSingle();
  const { data: offer } = await supabaseAdmin
    .from("product_offers")
    .select("name, price_dzd, price_usd, stock, products(name)")
    .eq("id", offerId)
    .maybeSingle();
  if (!pm || !offer) {
    await sendOrEditAppMessage({ chat_id: chatId, message_id: messageId, text: "❌" });
    return;
  }
  if ((offer.stock ?? 0) <= 0) {
    await deliver(chatId, t("stock_out_error", L), [[{ text: t("back_products", L), callback_data: "back:list" }]], messageId);
    return;
  }
  const productName = (offer.products as any)?.name ?? "";

  const isBinance = method === "binance";
  const lines = [
    `💳 <b>${escapeHtml(pm.display_name)}</b>`,
    "",
    `${t("product_label", L)}: ${escapeHtml(productName)} — ${escapeHtml(offer.name)}`,
    `${t("amount_due", L)}: <b>${formatPrice(offer.price_dzd, offer.price_usd, prefs.currency)}</b>`,
    "",
    pm.instructions ? `${t("instructions_label", L)}:\n${escapeHtml(pm.instructions)}` : "",
    pm.account_info ? `\n${t("account_label", L)}:\n<code>${escapeHtml(pm.account_info)}</code>` : "",
    "",
    t(isBinance ? "pay_then_send_binance" : "pay_then_send", L),
  ].filter(Boolean);

  const kb: InlineKeyboard = [
    [{ text: t(isBinance ? "i_paid_binance" : "i_paid", L), callback_data: `paid:${offerId}:${method}` }],
    [{ text: t("back", L), callback_data: "back:prod" }],
    [{ text: t("home_btn", L), callback_data: "home" }],
  ];

  await deliver(chatId, lines.join("\n"), kb, messageId);
}

export async function sendMyOrders(chatId: number, userId: string, messageId?: number, forceNew = false) {
  const prefs = await getChatPrefs(chatId);
  const L = prefs.language;
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, total_dzd, total_usd, status, payment_status, created_at, products(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!orders?.length) {
    const kb: InlineKeyboard = [[{ text: t("home_btn", L), callback_data: "home" }]];
    await deliver(chatId, t("no_orders", L), kb, messageId, forceNew);
    return;
  }
  const lines = [`<b>${t("my_orders_title", L)}</b>`, ""];
  for (const o of orders) {
    lines.push(
      `🆔 <code>${escapeHtml(o.order_number)}</code>\n` +
        `🛒 ${escapeHtml((o.products as any)?.name ?? "—")}\n` +
        `💰 ${formatPrice(o.total_dzd, o.total_usd, prefs.currency)} • ${t("status_label", L)}: <b>${escapeHtml(o.status)}</b> / ${t("payment_label", L)}: <b>${escapeHtml(o.payment_status)}</b>`,
    );
    lines.push("");
  }
  const kb: InlineKeyboard = [
    [{ text: t("menu_site", L), url: `${SITE_URL}/account` }],
    [{ text: t("home_btn", L), callback_data: "home" }],
  ];
  await deliver(chatId, lines.join("\n"), kb, messageId, forceNew);
}

/** Re-export parse helper for webhook routing. */
export { parseListCallback, nextSort };
