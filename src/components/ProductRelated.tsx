import { useQuery } from "@tanstack/react-query";
import { Tag } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCatalogProducts, lowestDzd, type CatalogProduct } from "@/lib/catalog-data";
import { ProductCard } from "./ProductCard";
import { useTranslation } from "react-i18next";

interface Props {
  product: CatalogProduct;
}

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  expires_at: string | null;
};

export function ProductRelated({ product }: Props) {
  const { t } = useTranslation();
  const { data: coupons = [] } = useQuery({
    queryKey: ["product-coupons", product.id, product.category_id],
    queryFn: async () => {
      const filters: string[] = [`product_id.eq.${product.id}`];
      if (product.category_id) filters.push(`category_id.eq.${product.category_id}`);
      const { data } = await supabase
        .from("coupons")
        .select("id, code, type, value, expires_at")
        .eq("active", true)
        .or(filters.join(","));
      const now = Date.now();
      return ((data as Coupon[]) ?? []).filter(
        (c) => !c.expires_at || new Date(c.expires_at).getTime() > now
      );
    },
  });

  const { data: allProducts = [] } = useCatalogProducts();

  const normFamily = (v: string | null | undefined) =>
    (v || "").trim().toLowerCase();
  const nameFamily = (name: string) =>
    (name || "")
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff\s]/g, " ")
      .trim()
      .split(/\s+/)[0] ?? "";

  const currentFamily = normFamily(product.family);

  let similar: typeof allProducts = [];

  if (currentFamily) {
    similar = allProducts
      .filter((p) => p.id !== product.id && normFamily(p.family) === currentFamily)
      .slice(0, 8);
  }

  if (similar.length === 0) {
    const key = nameFamily(product.name);
    similar = allProducts
      .filter((p) => p.id !== product.id && key.length > 0 && nameFamily(p.name) === key)
      .slice(0, 8);
  }

  if (similar.length === 0 && product.category_id) {
    similar = allProducts
      .filter((p) => p.id !== product.id && p.category_id === product.category_id)
      .slice(0, 8);
  }

  return (
    <div className="mt-10 sm:mt-16 space-y-8 sm:space-y-14">
      {coupons.length > 0 && (
        <section>
          <h2 className="font-display text-base sm:text-2xl mb-3 sm:mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            {t("Related offers")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {coupons.map((c) => (
              <div
                key={c.id}
                className="border border-dashed border-primary/40 bg-primary/5 rounded p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-mono text-primary text-lg">{c.code}</div>
                  <div className="font-mono-label text-muted-foreground text-[11px] mt-0.5">
                    {c.type === "percent" ? t("{{value}}% off", { value: c.value }) : t("-{{value}} off", { value: c.value })}
                  </div>
                </div>
                {c.expires_at && (
                  <div className="font-mono text-[10px] text-muted-foreground text-end">
                    {t("Expires")}
                    <br />
                    {new Date(c.expires_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="font-display text-base sm:text-2xl">{t("Similar products")}</h2>
            <Link
              to="/shop"
              className="font-mono-label text-[11px] sm:text-xs text-primary hover:underline uppercase tracking-wider"
            >
              {t("View all")}
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            {similar.map((p) => (
              <ProductCard
                key={p.id}
                name={p.name}
                category={p.categories?.name ?? "Digital"}
                priceDzd={lowestDzd(p.product_offers)}
                slug={p.slug}
                image={p.main_image}
                offers={p.product_offers}
              />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
