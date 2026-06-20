import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import allProducts from '../../../all_products.json';
import { DEFAULT_EXCHANGE_RATE } from '@/lib/constants';

// Initial categories definition
const initialCategories = [
  { id: "bb650ce7-1aa2-40f1-b1f4-5e1229681e4d", name: "AI & Software", sort_order: 1 },
  { id: "1d989115-74bc-429e-8184-f9d7d0a2468e", name: "Streaming", sort_order: 2 },
  { id: "5187e97d-4bca-40ba-b130-1dc3ae377f63", name: "Education & Utilities", sort_order: 3 },
  { id: "80663e03-c9f2-4f3a-97c1-76de0305279f", name: "IPTV", sort_order: 4 }
];

function getFamilyName(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("adobe")) return "Adobe Creative Cloud";
  if (lower.includes("amazon") || lower.includes("prime video")) return "Amazon Prime Video";
  if (lower.includes("capcut")) return "Capcut";
  if (lower.includes("chatgpt")) return "ChatGPT";
  if (lower.includes("claude")) return "Claude";
  if (lower.includes("crunchyroll")) return "Crunchyroll";
  if (lower.includes("cursor")) return "Cursor";
  if (lower.includes("deepseek")) return "DeepSeek";
  if (lower.includes("discord")) return "Discord Nitro";
  if (lower.includes("disney")) return "Disney+";
  if (lower.includes("duolingo")) return "Duolingo";
  if (lower.includes("grammarly")) return "Grammarly";
  if (lower.includes("iptv")) return "IPTV Subscriptions";
  if (lower.includes("kaspersky")) return "Kaspersky Antivirus";
  if (lower.includes("midjourney")) return "Midjourney";
  if (lower.includes("netflix")) return "Netflix";
  if (lower.includes("office") || lower.includes("microsoft 365")) return "Microsoft Office";
  if (lower.includes("spotify")) return "Spotify";
  if (lower.includes("shahid")) return "Shahid VIP";
  if (lower.includes("youtube")) return "YouTube Premium";
  if (lower.includes("zoom")) return "Zoom Meetings";
  if (lower.includes("vpn") || lower.includes("nordvpn")) return "NordVPN";
  if (lower.includes("canva")) return "Canva Pro";
  if (lower.includes("scribd")) return "Scribd";
  if (lower.includes("windows")) return "Windows License Key";
  if (lower.includes("antigravity")) return "Antigravity Slot";
  if (lower.includes("brazzers")) return "Brazzers";
  
  return title.split(" - ")[0].trim();
}

function getCategoryIdFromTitle(title: string): string {
  let category_id = "5187e97d-4bca-40ba-b130-1dc3ae377f63"; // default Education & Utilities
  const titleLower = title.toLowerCase();
  if (titleLower.includes("netflix") || titleLower.includes("spotify") || titleLower.includes("crunchyroll") || titleLower.includes("disney") || titleLower.includes("prime video") || titleLower.includes("youtube") || titleLower.includes("shahid") || titleLower.includes("apple") || titleLower.includes("starzplay") || titleLower.includes("iptv")) {
    category_id = "1d989115-74bc-429e-8184-f9d7d0a2468e"; // Streaming
  } else if (titleLower.includes("chatgpt") || titleLower.includes("claude") || titleLower.includes("midjourney") || titleLower.includes("cursor") || titleLower.includes("adobe") || titleLower.includes("deepseek") || titleLower.includes("office") || titleLower.includes("windows") || titleLower.includes("canva") || titleLower.includes("capcut") || titleLower.includes("antigravity")) {
    category_id = "bb650ce7-1aa2-40f1-b1f4-5e1229681e4d"; // AI & Software
  }
  return category_id;
}

function getGroupedData() {
  const productsArray = Array.isArray(allProducts) 
    ? allProducts 
    : (allProducts && Array.isArray((allProducts as any).products))
      ? (allProducts as any).products
      : [];

  const groupedMap = new Map<string, any[]>();
  productsArray.forEach((p: any) => {
    const familyName = getFamilyName(p.title);
    if (!groupedMap.has(familyName)) groupedMap.set(familyName, []);
    groupedMap.get(familyName)!.push(p);
  });

  const localProducts: any[] = [];
  const localOffers: any[] = [];

  Array.from(groupedMap.entries()).forEach(([familyName, items]) => {
    const familySlug = familyName.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const firstItem = items.find(i => !!i.logo_url) || items[0];
    const category_id = getCategoryIdFromTitle(familyName);
    const accountTypes = Array.from(new Set(items.map(i => i.account_type).filter(Boolean)));
    const offerTypes = Array.from(new Set(items.map(i => i.offer_type).filter(Boolean)));
    const allTags = [...accountTypes, ...offerTypes];
    const productId = `prod-${familySlug}`;

    localProducts.push({
      id: productId,
      name: familyName,
      slug: familySlug,
      short_description: firstItem.description ? firstItem.description.slice(0, 100) + "..." : null,
      description: firstItem.description || null,
      main_image: firstItem.logo_url || null,
      featured: false,
      visible: true,
      rating: 5,
      rating_count: 0,
      sales_count: 0,
      category_id,
      family: familyName,
      tags: allTags,
      account_type: accountTypes.join(", "),
      offer_type: offerTypes.join(", ")
    });

    items.forEach((item, index) => {
      localOffers.push({
        id: item.id,
        product_id: productId,
        name: item.title,
        original_title: item.original_title || item.title,
        duration: item.duration || null,
        warranty: item.duration || "Period of Subscription",
        delivery_method: item.delivery_method || null,
        delivery_type: "manual",
        supplier: item.supplier || null,
        price_dzd: item.price_dzd,
        price_usd: item.price_usd ?? 0,
        stock: 99,
        active: item.active !== undefined ? item.active : true,
        sort_order: index,
        product_url: item.product_url || null,
        account_type: item.account_type || null,
        offer_type: item.offer_type || null
      });
    });
  });

  return { localProducts, localOffers };
}

// Initialize local DB in localStorage from all_products.json if not already initialized
if (typeof window !== 'undefined' && !localStorage.getItem("local_db_initialized_v2")) {
  console.log("Initializing local mock database in localStorage (v2 grouped by family)...");
  
  const { localProducts, localOffers } = getGroupedData();

  localStorage.setItem("local_products", JSON.stringify(localProducts));
  localStorage.setItem("local_product_offers", JSON.stringify(localOffers));
  localStorage.setItem("local_categories", JSON.stringify(initialCategories));
  localStorage.setItem("local_user_roles", JSON.stringify([{ user_id: "local-user-id", role: "admin" }]));
  localStorage.setItem("local_profiles", JSON.stringify([{ id: "local-user-id", full_name: "Local Admin", phone: "0555555555" }]));
  localStorage.setItem("local_orders", JSON.stringify([]));
  localStorage.setItem("local_order_messages", JSON.stringify([]));
  localStorage.setItem("local_payment_receipts", JSON.stringify([]));
  localStorage.setItem("local_payment_methods", JSON.stringify([
    { id: "binance", method: "binance", display_name: "Binance Pay", active: true, account_info: "admin@local.test" },
    { id: "baridimob", method: "baridimob", display_name: "BaridiMob", active: true, account_info: "007999990000000000" }
  ]));
  localStorage.setItem("local_exchange_rate", JSON.stringify([{ id: "rate-1", rate: DEFAULT_EXCHANGE_RATE }]));
  localStorage.setItem("local_coupons", JSON.stringify([]));
  localStorage.setItem("local_notifications", JSON.stringify([]));
  
  localStorage.setItem("local_db_initialized_v2", "true");
}

const EXPRESS_API = "http://localhost:3001";

// Mirror an offer change to all_products.json via Express API
async function mirrorToExpress(table: string, items: any[], updatePayload?: any, isDelete?: boolean) {
  if (typeof window === 'undefined') return;
  if (table !== "product_offers" && table !== "products") return;
  
  try {
    if (table === "product_offers") {
      for (const item of items) {
        if (isDelete) {
          await fetch(`${EXPRESS_API}/api/product/${item.id}`, { method: "DELETE" });
        } else if (updatePayload) {
          const body: any = {};
          if (updatePayload.name !== undefined) body.title = updatePayload.name;
          if (updatePayload.price_usd !== undefined) body.price_usd = updatePayload.price_usd;
          if (updatePayload.price_dzd !== undefined) body.price_dzd = updatePayload.price_dzd;
          if (updatePayload.supplier !== undefined) body.supplier = updatePayload.supplier;
          if (updatePayload.product_url !== undefined) body.product_url = updatePayload.product_url;
          if (updatePayload.duration !== undefined) body.duration = updatePayload.duration;
          if (updatePayload.active !== undefined) body.active = updatePayload.active;
          if (updatePayload.delivery_method !== undefined) body.delivery_method = updatePayload.delivery_method;
          if (updatePayload.account_type !== undefined) body.account_type = updatePayload.account_type;
          if (updatePayload.offer_type !== undefined) body.offer_type = updatePayload.offer_type;
          if (updatePayload.sort_order !== undefined) body.sort_order = updatePayload.sort_order;
          if (updatePayload.warranty !== undefined) body.warranty = updatePayload.warranty;
          if (updatePayload.delivery_type !== undefined) body.delivery_type = updatePayload.delivery_type;
          if (updatePayload.discount_usd !== undefined) body.discount_usd = updatePayload.discount_usd;
          if (updatePayload.stock !== undefined) body.stock = updatePayload.stock;
          if (updatePayload.delivery_notes !== undefined) body.delivery_notes = updatePayload.delivery_notes;
          await fetch(`${EXPRESS_API}/api/product/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
      }
    } else if (table === "products" && updatePayload) {
      // Mirror ALL product-level changes to JSON via family-update
      for (const item of items) {
        await fetch(`${EXPRESS_API}/api/product/family-update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: item.id,
            name: updatePayload.name,
            main_image: updatePayload.main_image,
            visible: updatePayload.visible,
            featured: updatePayload.featured,
            description: updatePayload.description,
            short_description: updatePayload.short_description,
            original_price_dzd: updatePayload.original_price_dzd,
            account_type: updatePayload.account_type,
            offer_type: updatePayload.offer_type,
            delivery_type: updatePayload.delivery_type,
            rating: updatePayload.rating,
            rating_count: updatePayload.rating_count,
            sales_count: updatePayload.sales_count,
            seo_title: updatePayload.seo_title,
            seo_description: updatePayload.seo_description,
            banner_image: updatePayload.banner_image,
            original_title: updatePayload.original_title,
          }),
        });
      }
    }
  } catch(e) {
    console.warn("[API] Mirror to Express failed:", e);
  }
}

class LocalQueryBuilder {
  table: string;
  data: any[];
  filters: ((item: any) => boolean)[];
  orderBy: { col: string; ascending: boolean } | null;
  limitVal: number | null;
  updatePayload: any | null;
  deleteMode: boolean;

  constructor(table: string) {
    this.table = table;
    this.filters = [];
    this.orderBy = null;
    this.limitVal = null;
    this.updatePayload = null;
    this.deleteMode = false;

    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(`local_${table}`);
      this.data = raw ? JSON.parse(raw) : [];
    } else {
      // Server-Side Rendering (SSR) initial fallback data to prevent empty page load / crash
      if (table === "products") {
        const { localProducts } = getGroupedData();
        this.data = localProducts;
      } else if (table === "product_offers") {
        const { localOffers } = getGroupedData();
        this.data = localOffers;
      } else if (table === "categories") {
        this.data = initialCategories;
      } else if (table === "payment_methods") {
        this.data = [
          { id: "binance", method: "binance", display_name: "Binance Pay", active: true, account_info: "admin@local.test" },
          { id: "baridimob", method: "baridimob", display_name: "BaridiMob", active: true, account_info: "007999990000000000" }
        ];
      } else if (table === "exchange_rate") {
        this.data = [{ id: "rate-1", rate: DEFAULT_EXCHANGE_RATE }];
      } else if (table === "profiles") {
        this.data = [{ id: "local-user-id", full_name: "Local Admin", phone: "0555555555" }];
      } else if (table === "user_roles") {
        this.data = [{ user_id: "local-user-id", role: "admin" }];
      } else {
        this.data = [];
      }
    }
  }

  select(columns?: string) {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((item) => values.includes(item[column]));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { col: column, ascending: options?.ascending !== false };
    return this;
  }

  limit(val: number) {
    this.limitVal = val;
    return this;
  }

  async executeSelect() {
    let result = [...this.data];
    for (const filter of this.filters) {
      result = result.filter(filter);
    }
    if (this.orderBy) {
      const { col, ascending } = this.orderBy;
      result.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
      });
    }
    if (this.limitVal !== null) {
      result = result.slice(0, this.limitVal);
    }

    const categoriesStore = typeof window !== 'undefined' 
      ? JSON.parse(localStorage.getItem("local_categories") || "[]")
      : initialCategories;

    // Embed categories and offers on products SELECT
    if (this.table === "products") {
      const offersStore = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem("local_product_offers") || "[]")
        : []; // On server, product_offers won't require complex links or will fall back
      result = result.map(p => ({
        ...p,
        categories: categoriesStore.find((c: any) => c.id === p.category_id) || null,
        product_offers: typeof window !== 'undefined' 
          ? offersStore.filter((o: any) => o.product_id === p.id)
          : [] // On server fallback empty or map directly if needed
      }));
    }

    // Embed products on product_offers SELECT
    if (this.table === "product_offers") {
      const productsStore = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem("local_products") || "[]")
        : [];
      result = result.map(o => ({
        ...o,
        products: productsStore.find((p: any) => p.id === o.product_id) || null
      }));
    }

    // Embed products, offers, receipts, and profiles on orders SELECT
    if (this.table === "orders") {
      const productsStore = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("local_products") || "[]") : [];
      const offersStore = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("local_product_offers") || "[]") : [];
      const receiptsStore = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("local_payment_receipts") || "[]") : [];
      const profilesStore = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("local_profiles") || "[]") : [];
      result = result.map(o => ({
        ...o,
        products: productsStore.find((p: any) => p.id === o.product_id) || null,
        product_offers: offersStore.find((of: any) => of.id === o.offer_id) || null,
        payment_receipts: receiptsStore.filter((r: any) => r.order_id === o.id),
        profiles: profilesStore.find((pr: any) => pr.id === o.user_id) || null
      }));
    }

    // Embed orders on payment_receipts SELECT
    if (this.table === "payment_receipts") {
      const ordersStore = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("local_orders") || "[]") : [];
      const productsStore = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("local_products") || "[]") : [];
      result = result.map(r => {
        const order = ordersStore.find((o: any) => o.id === r.order_id) || null;
        if (order) {
          order.products = productsStore.find((p: any) => p.id === order.product_id) || null;
        }
        return {
          ...r,
          orders: order
        };
      });
    }

    // Embed products, parent and offers on categories SELECT
    if (this.table === "categories") {
      const productsStore = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem("local_products") || "[]")
        : [];
      const offersStore = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem("local_product_offers") || "[]")
        : [];
      result = result.map(c => {
        const categoryProducts = productsStore
          .filter((p: any) => p.category_id === c.id)
          .map((p: any) => ({
            ...p,
            product_offers: offersStore.filter((o: any) => o.product_id === p.id)
          }));
        return {
          ...c,
          products: categoryProducts,
          parent: categoriesStore.find((pCat: any) => pCat.id === c.parent_id) || null
        };
      });
    }

    return { data: result, error: null };
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    if (this.updatePayload !== null) {
      return this.executeUpdate().then(onfulfilled, onrejected);
    }
    if (this.deleteMode) {
      return this.executeDelete().then(onfulfilled, onrejected);
    }
    return this.executeSelect().then(onfulfilled, onrejected);
  }

  async maybeSingle() {
    if (this.updatePayload !== null) {
      const { data } = await this.executeUpdate();
      return { data: data[0] || null, error: null };
    }
    if (this.deleteMode) {
      await this.executeDelete();
      return { data: null, error: null };
    }
    const { data } = await this.executeSelect();
    return { data: data[0] || null, error: null };
  }

  async single() {
    if (this.updatePayload !== null) {
      const { data } = await this.executeUpdate();
      return { data: data[0] || null, error: data[0] ? null : { message: "Not found" } };
    }
    if (this.deleteMode) {
      await this.executeDelete();
      return { data: null, error: null };
    }
    const { data } = await this.executeSelect();
    return { data: data[0] || null, error: data[0] ? null : { message: "Not found" } };
  }

  async insert(payload: any) {
    const items = Array.isArray(payload) ? payload : [payload];
    const newItems = items.map(item => ({
      id: item.id || Math.random().toString(36).slice(2) + "-" + Math.random().toString(36).slice(2),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...item
    }));
    this.data.push(...newItems);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`local_${this.table}`, JSON.stringify(this.data));
    }
    
    return {
      data: newItems.length === 1 ? newItems[0] : newItems,
      error: null,
      select: () => ({
        single: () => ({ data: newItems[0], error: null })
      })
    };
  }

  async executeUpdate() {
    let affected = 0;
    const matchedItems: any[] = [];
    this.data = this.data.map(item => {
      let match = true;
      for (const filter of this.filters) {
        if (!filter(item)) {
          match = false;
          break;
        }
      }
      if (match) {
        affected++;
        const updated = { ...item, ...this.updatePayload, updated_at: new Date().toISOString() };
        matchedItems.push(updated);
        return updated;
      }
      return item;
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem(`local_${this.table}`, JSON.stringify(this.data));
      mirrorToExpress(this.table, matchedItems, this.updatePayload);
    }
    return { data: this.data, error: null };
  }

  async executeDelete() {
    const nextData: any[] = [];
    const deletedItems: any[] = [];
    for (const item of this.data) {
      let match = true;
      for (const filter of this.filters) {
        if (!filter(item)) {
          match = false;
          break;
        }
      }
      if (!match) {
        nextData.push(item);
      } else {
        deletedItems.push(item);
      }
    }
    this.data = nextData;
    if (typeof window !== 'undefined') {
      localStorage.setItem(`local_${this.table}`, JSON.stringify(this.data));
      mirrorToExpress(this.table, deletedItems, undefined, true);
    }
    return { data: null, error: null };
  }

  update(payload: any) {
    this.updatePayload = payload;
    return this;
  }

  delete() {
    this.deleteMode = true;
    return this;
  }
}

const localAuth = {
  async getSession() {
    return {
      data: {
        session: {
          access_token: "mock-token",
          user: {
            id: "local-user-id",
            email: "admin@local.test",
            user_metadata: { full_name: "Local Admin" }
          }
        }
      },
      error: null
    };
  },
  onAuthStateChange(cb: any) {
    setTimeout(() => {
      cb("SIGNED_IN", {
        access_token: "mock-token",
        user: {
          id: "local-user-id",
          email: "admin@local.test",
          user_metadata: { full_name: "Local Admin" }
        }
      });
    }, 0);
    return {
      data: {
        subscription: {
          unsubscribe() {}
        }
      }
    };
  },
  async signInWithPassword() {
    return {
      data: {
        session: { access_token: "mock-token" },
        user: { id: "local-user-id", email: "admin@local.test" }
      },
      error: null
    };
  },
  async signUp() {
    return {
      data: {
        session: { access_token: "mock-token" },
        user: { id: "local-user-id", email: "admin@local.test" }
      },
      error: null
    };
  },
  async signOut() {
    return { error: null };
  }
};

const mockChannel = {
  on(event: string, filter: any, callback: any) {
    return mockChannel;
  },
  subscribe() {
    return mockChannel;
  }
};

const localClient = {
  from(table: string) {
    return new LocalQueryBuilder(table);
  },
  auth: localAuth,
  channel(name: string) {
    return mockChannel;
  },
  removeChannel(channel: any) {
    // do nothing
  }
};

function createSupabaseClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const hasRealSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
  const browserOverride = typeof window !== 'undefined' ? localStorage.getItem("use_real_supabase") : null;
  const isProdRuntime = import.meta.env.PROD || process.env.NODE_ENV === "production";

  // Force real Supabase as requested by user
  const useRealSupabase = true;

  if (!useRealSupabase) {
    console.log("[Supabase] Using local mock client");
    return localClient as any;
  }

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Connect Supabase in Lovable Cloud.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
