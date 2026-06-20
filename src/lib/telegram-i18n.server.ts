// i18n + chat preferences for the Telegram bot.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Lang = "ar" | "en";
export type Currency = "DZD" | "USD";
import { DEFAULT_EXCHANGE_RATE } from "./constants";

export interface ChatPrefs {
  language: Lang;
  currency: Currency;
}

const DEFAULT_PREFS: ChatPrefs = { language: "ar", currency: "DZD" };

export async function getChatPrefs(chatId: number): Promise<ChatPrefs> {
  const { data } = await supabaseAdmin
    .from("telegram_chat_prefs")
    .select("language, currency")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (!data) return DEFAULT_PREFS;
  return {
    language: (data.language === "en" ? "en" : "ar"),
    currency: (data.currency === "USD" ? "USD" : "DZD"),
  };
}

export async function setChatLanguage(chatId: number, language: Lang) {
  await supabaseAdmin.from("telegram_chat_prefs").upsert({
    chat_id: chatId,
    language,
    updated_at: new Date().toISOString(),
  });
}

export async function setChatCurrency(chatId: number, currency: Currency) {
  await supabaseAdmin.from("telegram_chat_prefs").upsert({
    chat_id: chatId,
    currency,
    updated_at: new Date().toISOString(),
  });
}

export async function hasPrefs(chatId: number): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("telegram_chat_prefs")
    .select("chat_id")
    .eq("chat_id", chatId)
    .maybeSingle();
  return !!data;
}

type Dict = Record<string, { ar: string; en: string }>;

const DICT: Dict = {
  welcome_title: { ar: "🏪 أهلاً بك في فولت", en: "🏪 Welcome to Vault" },
  pick_language: { ar: "🌐 اختر لغتك", en: "🌐 Choose your language" },
  pick_currency: { ar: "💱 اختر عملة العرض", en: "💱 Choose display currency" },
  currency_usd_note: {
    ar: "⚠️ <i>بالدولار: الدفع عبر Binance فقط</i>",
    en: "⚠️ <i>With USD: payment via Binance only</i>",
  },
  currency_dzd_note: {
    ar: "⚠️ <i>بالدينار: الدفع عبر Baridi Mob فقط</i>",
    en: "⚠️ <i>With DZD: payment via Baridi Mob only</i>",
  },
  currency_selected_usd: {
    ar: "✅ تم اختيار الدولار ($)\n⚠️ الدفع سيتم عبر <b>Binance</b> فقط.",
    en: "✅ USD selected\n⚠️ Payment will be via <b>Binance</b> only.",
  },
  currency_selected_dzd: {
    ar: "✅ تم اختيار الدينار (DA)\n⚠️ الدفع سيتم عبر <b>Baridi Mob</b> فقط.",
    en: "✅ DZD selected\n⚠️ Payment will be via <b>Baridi Mob</b> only.",
  },
  menu_browse: { ar: "🛍️ تصفح المنتجات", en: "🛍️ Browse products" },
  menu_orders: { ar: "📦 طلباتي", en: "📦 My orders" },
  menu_link: { ar: "🔗 ربط حسابي", en: "🔗 Link my account" },
  menu_linked: { ar: "✅ حسابك مربوط", en: "✅ Account linked" },
  menu_site: { ar: "🌐 فتح الموقع", en: "🌐 Open website" },
  menu_settings: { ar: "⚙️ الإعدادات", en: "⚙️ Settings" },
  not_linked_warn: {
    ar: "⚠️ حسابك غير مربوط بعد. اربط لتتمكن من الشراء.",
    en: "⚠️ Your account is not linked yet. Link it to purchase.",
  },
  pick_category: { ar: "🛍️ اختر فئة", en: "🛍️ Choose a category" },
  all_products: { ar: "✨ كل المنتجات", en: "✨ All products" },
  back_home: { ar: "« الرئيسية", en: "« Home" },
  back_categories: { ar: "« الفئات", en: "« Categories" },
  back_products: { ar: "« المنتجات", en: "« Products" },
  back: { ar: "« رجوع", en: "« Back" },
  prev: { ar: "◀️ السابق", en: "◀️ Previous" },
  next: { ar: "التالي ▶️", en: "Next ▶️" },
  no_products: { ar: "لا توجد منتجات.", en: "No products available." },
  pick_product: { ar: "اختر منتجاً:", en: "Choose a product:" },
  offers_available: { ar: "العروض المتاحة:", en: "Available offers:" },
  no_offers: { ar: "لا توجد عروض حالياً.", en: "No offers available." },
  out_of_stock: { ar: "نفذ", en: "Out of stock" },
  purchases_count: { ar: "عملية شراء", en: "purchases" },
  pick_payment: { ar: "💳 اختر طريقة الدفع:", en: "💳 Choose payment method:" },
  product_label: { ar: "🛒 المنتج", en: "🛒 Product" },
  offer_label: { ar: "📦 العرض", en: "📦 Offer" },
  total_label: { ar: "💰 الإجمالي", en: "💰 Total" },
  amount_due: { ar: "💰 المبلغ المطلوب", en: "💰 Amount due" },
  instructions_label: { ar: "📋 التعليمات", en: "📋 Instructions" },
  account_label: { ar: "🏦 الحساب", en: "🏦 Account" },
  pay_then_send: {
    ar: "✅ بعد الدفع، اضغط الزر وأرسل صورة الوصل.",
    en: "✅ After paying, tap the button and send the receipt photo.",
  },
  pay_then_send_binance: {
    ar: "✅ بعد الدفع، اضغط الزر وأرسل معرف الدفع (Transaction ID).",
    en: "✅ After paying, tap the button and send the Transaction ID.",
  },
  i_paid: { ar: "📸 لقد دفعت — إرسال الوصل", en: "📸 I paid — send receipt" },
  i_paid_binance: { ar: "🔑 لقد دفعت — إرسال معرف الدفع", en: "🔑 I paid — send Transaction ID" },
  other_methods: { ar: "« طرق دفع أخرى", en: "« Other methods" },
  send_receipt_now: {
    ar: "📸 أرسل الآن صورة وصل الدفع هنا في المحادثة.",
    en: "📸 Now send the payment receipt photo here in this chat.",
  },
  send_txid_now: {
    ar: "🔑 أرسل الآن معرف دفع Binance Pay (Transaction ID) هنا في المحادثة.\n\n<i>لا ترسل صورة — أرسل المعرف كنص فقط.</i>",
    en: "🔑 Now send your Binance Pay Transaction ID here in this chat.\n\n<i>Do not send a photo — send the ID as text only.</i>",
  },
  binance_no_photo: {
    ar: "⚠️ الدفع عبر Binance يتطلب <b>معرف المعاملة (Transaction ID)</b> كنص.\n\n🔑 أرسل المعرف هنا — لا ترسل صورة.",
    en: "⚠️ Binance payment requires the <b>Transaction ID</b> as text.\n\n🔑 Send the ID here — do not send a photo.",
  },
  stock_out_error: {
    ar: "❌ عذراً، هذا المنتج نفد من المخزون.",
    en: "❌ Sorry, this item is out of stock.",
  },
  must_link_first: {
    ar: "⚠️ يجب ربط حسابك أولاً قبل إتمام الشراء.",
    en: "⚠️ You must link your account before purchasing.",
  },
  link_title: { ar: "🔗 ربط حسابك", en: "🔗 Link your account" },
  link_body: {
    ar: "افتح الرابط التالي من حسابك على الموقع (يجب أن تكون مسجلاً للدخول).",
    en: "Open the link below from your website account (you must be signed in).",
  },
  link_valid_15: { ar: "⏱️ الرابط صالح لمدة 15 دقيقة.", en: "⏱️ Link valid for 15 minutes." },
  link_open_webapp: { ar: "🚀 فتح صفحة الربط", en: "🚀 Open link page" },
  my_orders_title: { ar: "📦 آخر طلباتك:", en: "📦 Your latest orders:" },
  no_orders: { ar: "ليس لديك أي طلبات بعد.", en: "You have no orders yet." },
  status_label: { ar: "الحالة", en: "Status" },
  payment_label: { ar: "دفع", en: "Payment" },
  approved_msg: {
    ar: "✅ <b>تم قبول الدفع!</b>\nسيتم تجهيز طلبك قريباً.",
    en: "✅ <b>Payment approved!</b>\nYour order will be prepared shortly.",
  },
  rejected_msg: {
    ar: "❌ <b>تم رفض الدفع.</b>\nيرجى مراجعة الإدارة.",
    en: "❌ <b>Payment rejected.</b>\nPlease contact support.",
  },
  settings_title: { ar: "⚙️ الإعدادات", en: "⚙️ Settings" },
  change_language: { ar: "🌐 تغيير اللغة", en: "🌐 Change language" },
  change_currency: { ar: "💱 تغيير العملة", en: "💱 Change currency" },
  // Reply keyboard (main menu at bottom)
  rk_products: { ar: "🛍️ المنتجات", en: "🛍️ Products" },
  rk_support: { ar: "💬 الدعم", en: "💬 Support" },
  rk_orders: { ar: "📦 طلباتي", en: "📦 My Orders" },
  rk_settings: { ar: "⚙️ الإعدادات", en: "⚙️ Settings" },
  rk_site: { ar: "🌐 الموقع", en: "🌐 Website" },
  // Catalog UI
  catalog_title: { ar: "🛍️ <b>كتالوج المنتجات</b>", en: "🛍️ <b>Product Catalog</b>" },
  catalog_page: { ar: "صفحة", en: "Page" },
  sort_all: { ar: "الكل", en: "All" },
  sort_price: { ar: "السعر", en: "Price" },
  sort_popular: { ar: "الأكثر مبيعاً", en: "Popular" },
  sort_label: { ar: "ترتيب", en: "Sort" },
  refresh: { ar: "🔄 تحديث", en: "🔄 Refresh" },
  home_btn: { ar: "🏠 الرئيسية", en: "🏠 Home" },
  support_title: { ar: "💬 <b>الدعم الفني</b>", en: "💬 <b>Support</b>" },
  support_body: {
    ar: "للحصول على المساعدة، تواصل معنا عبر الموقع أو أرسل رسالتك هنا وسنرد عليك قريباً.",
    en: "For help, contact us via the website or send your message here and we'll reply soon.",
  },
  welcome_subtitle: {
    ar: "اختر من القائمة أدناه للبدء 👇",
    en: "Choose from the menu below to get started 👇",
  },
};

export function t(key: keyof typeof DICT, lang: Lang): string {
  return DICT[key][lang];
}

/** All reply-keyboard button labels for the current language (for matching incoming text). */
export function replyMenuTexts(lang: Lang): string[] {
  return [
    t("rk_products", lang),
    t("rk_support", lang),
    t("rk_orders", lang),
    t("rk_settings", lang),
    t("rk_site", lang),
  ];
}

export function isReplyMenuText(text: string, lang: Lang): boolean {
  return replyMenuTexts(lang).includes(text.trim());
}

export function formatPrice(
  priceDzd: number | null | undefined,
  priceUsd: number | null | undefined,
  currency: Currency,
): string {
  if (currency === "USD") {
    const v = Number(priceUsd ?? (priceDzd ? Number(priceDzd) / DEFAULT_EXCHANGE_RATE : 0));
    return `$${v.toFixed(2)}`;
  }
  const v = Number(priceDzd ?? Number(priceUsd ?? 0) * DEFAULT_EXCHANGE_RATE);
  return `${Math.round(v).toLocaleString()} DA`;
}
