import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CatalogOffer = {
  id: string;
  name: string;
  original_title?: string;
  duration: string | null;
  warranty: string | null;
  delivery_method: string | null;
  price_dzd: number | null;
  price_usd: number | null;
  supplier: string | null;
  product_url: string | null;
  account_type: string | null;
  offer_type: string | null;
  stock: number;
  sort_order: number;
};

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  main_image: string | null;
  featured: boolean;
  sales_count: number | null;
  rating: number | null;
  rating_count: number | null;
  created_at: string;
  category_id: string | null;
  family: string | null;
  tags: string[] | null;
  account_type: string | null;
  offer_type: string | null;
  visible: boolean;
  categories: { name: string | null } | null;
  product_offers: CatalogOffer[];
};

function sortOffers(offers: CatalogOffer[] = []) {
  return [...offers].sort((a, b) => {
    const priceA = Number(a.price_dzd ?? Number.MAX_SAFE_INTEGER);
    const priceB = Number(b.price_dzd ?? Number.MAX_SAFE_INTEGER);
    return a.sort_order - b.sort_order || priceA - priceB;
  });
}

export function lowestDzd(offers: CatalogOffer[] = []) {
  const prices = offers
    .map((offer) => Number(offer.price_dzd ?? 0))
    .filter((price) => price > 0);
  return prices.length ? Math.min(...prices) : null;
}

export function useCatalogProducts() {
  return useQuery({
    queryKey: ["catalog", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, short_description, description, main_image, featured, sales_count, rating, rating_count, created_at, category_id, family, tags, account_type, offer_type, categories(name), product_offers(id, name, original_title, duration, warranty, delivery_method, price_dzd, price_usd, supplier, product_url, account_type, offer_type, stock, sort_order, active)")
        .eq("visible", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((product: any) => {
        const account_type = product.account_type || (product.tags?.includes("Private") ? "Private" : product.tags?.includes("Shared") ? "Shared" : product.tags?.includes("Family") ? "Family" : null);
        const offer_type = product.offer_type || (product.tags?.includes("Premium") ? "Premium" : product.tags?.includes("Pro") ? "Pro" : product.tags?.includes("Plus") ? "Plus" : product.tags?.includes("Max") ? "Max" : product.tags?.includes("Basic") ? "Basic" : product.tags?.includes("Standard") ? "Standard" : product.tags?.includes("Free") ? "Free" : product.tags?.includes("Trial") ? "Trial" : product.tags?.includes("Lite") ? "Lite" : null);
        return {
          ...product,
          account_type,
          offer_type,
          product_offers: sortOffers((product.product_offers ?? []).filter((o: any) => o.active !== false)),
        };
      }) as CatalogProduct[];
    },
  });
}

export function useCatalogProduct(slug: string) {
  return useQuery({
    queryKey: ["catalog", "product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, short_description, description, main_image, featured, sales_count, rating, rating_count, created_at, category_id, family, tags, account_type, offer_type, categories(name), product_offers(id, name, original_title, duration, warranty, delivery_method, price_dzd, price_usd, supplier, product_url, account_type, offer_type, stock, sort_order, active)")
        .eq("slug", slug)
        .eq("visible", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const product = data as any;
      const account_type = product.account_type || (product.tags?.includes("Private") ? "Private" : product.tags?.includes("Shared") ? "Shared" : product.tags?.includes("Family") ? "Family" : null);
      const offer_type = product.offer_type || (product.tags?.includes("Premium") ? "Premium" : product.tags?.includes("Pro") ? "Pro" : product.tags?.includes("Plus") ? "Plus" : product.tags?.includes("Max") ? "Max" : product.tags?.includes("Basic") ? "Basic" : product.tags?.includes("Standard") ? "Standard" : product.tags?.includes("Free") ? "Free" : product.tags?.includes("Trial") ? "Trial" : product.tags?.includes("Lite") ? "Lite" : null);

      return {
        ...product,
        account_type,
        offer_type,
        product_offers: sortOffers((product.product_offers ?? []).filter((o: any) => o.active !== false)),
      } as CatalogProduct;
    },
    enabled: !!slug,
  });
}

export function useCatalogCategories() {
  return useQuery({
    queryKey: ["catalog", "categories"],
    queryFn: async () => {
      const { data: categories, error } = await supabase
        .from("categories")
        .select("id, name, slug, visible, sort_order, parent_id")
        .eq("visible", true)
        .order("sort_order");

      if (error) throw error;

      const { data: products, error: productsError } = await supabase
        .from("products")
        .select(
          "id, name, slug, short_description, description, main_image, featured, sales_count, rating, rating_count, created_at, category_id, family, tags, account_type, offer_type, visible, categories(name), product_offers(id, name, original_title, duration, warranty, delivery_method, price_dzd, price_usd, supplier, product_url, account_type, offer_type, stock, sort_order, active)",
        )
        .eq("visible", true)
        .order("created_at", { ascending: false });

      if (productsError) throw productsError;

      const productMap = new Map<string, CatalogProduct[]>();
      for (const rawProduct of products ?? []) {
        const product: any = rawProduct;
        const account_type =
          product.account_type ||
          (product.tags?.includes("Private")
            ? "Private"
            : product.tags?.includes("Shared")
              ? "Shared"
              : product.tags?.includes("Family")
                ? "Family"
                : null);
        const offer_type =
          product.offer_type ||
          (product.tags?.includes("Premium")
            ? "Premium"
            : product.tags?.includes("Pro")
              ? "Pro"
              : product.tags?.includes("Plus")
                ? "Plus"
                : product.tags?.includes("Max")
                  ? "Max"
                  : product.tags?.includes("Basic")
                    ? "Basic"
                    : product.tags?.includes("Standard")
                      ? "Standard"
                      : product.tags?.includes("Free")
                        ? "Free"
                        : product.tags?.includes("Trial")
                          ? "Trial"
                          : product.tags?.includes("Lite")
                            ? "Lite"
                            : null);

        const normalized = {
          ...product,
          account_type,
          offer_type,
          product_offers: sortOffers((product.product_offers ?? []).filter((o: any) => o.active !== false)),
        } as CatalogProduct;

        const bucket = productMap.get(product.category_id ?? "") ?? [];
        bucket.push(normalized);
        productMap.set(product.category_id ?? "", bucket);
      }

      return (categories ?? []).map((category: any) => ({
        ...category,
        products: productMap.get(category.id) ?? [],
      }));
    },
  });
}
