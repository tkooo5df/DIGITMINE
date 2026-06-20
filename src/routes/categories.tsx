import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTranslation } from "react-i18next";
import { useCatalogCategories, lowestDzd } from "@/lib/catalog-data";
import { gradientFromName, letterFromName } from "@/lib/product-visual";
import { Tv, Cpu, ShieldCheck, Clock, ArrowRight, ChevronRight, ChevronDown, ChevronUp, PackageOpen } from "lucide-react";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Categories — DIGITMINE" },
      { name: "description", content: "Browse premium subscriptions, AI tools, games, and streaming options by category." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { t } = useTranslation();
  const { data: categories = [], isLoading } = useCatalogCategories();

  // Filter main parent categories and subcategories
  const mainCategories = categories
    .filter((c: any) => !c.parent_id)
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const getSubcategories = (parentId: string) => {
    return categories
      .filter((c: any) => c.parent_id === parentId)
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  };

  const getCategoryIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("stream") || n.includes("بث") || n.includes("نتفلكس")) return <Tv className="w-5 h-5 text-primary" />;
    return <Cpu className="w-5 h-5 text-primary" />;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 w-full space-y-16">
        {/* Page Hero */}
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            {t("Browse")}
          </p>
          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl">
            {t("By")} <span className="italic text-primary">{t("category.")}</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            تصفح خدماتنا الرقمية المنظمة حسب الفئات والعائلات. اختر اشتراكك المفضل، قارن بين العروض المتنوعة، واحصل على كود التفعيل خلال دقائق.
          </p>
        </section>

        {isLoading && (
          <div className="py-24 text-center">
            <span className="font-mono-label text-muted-foreground animate-pulse">{t("Loading…")}</span>
          </div>
        )}

        {!isLoading && mainCategories.length === 0 && (
          <div className="py-24 text-center border border-dashed border-border rounded-2xl bg-surface/50">
            <PackageOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-mono-label">{t("No categories found.")}</p>
          </div>
        )}

        {!isLoading && mainCategories.map((parent: any) => {
          const subs = getSubcategories(parent.id);
          
          return (
            <section key={parent.id} className="space-y-6">
              {/* Parent Category Header */}
              <div className="flex items-center gap-3 border-b border-border pb-3">
                {getCategoryIcon(parent.name)}
                <h2 className="font-display text-2xl sm:text-3xl text-foreground">
                  {parent.name}
                </h2>
                <span className="font-mono text-xs text-muted-foreground bg-surface px-2 py-1 border border-border rounded-full ms-2">
                  {subs.length} عائلات
                </span>
              </div>

              {subs.length === 0 ? (
                // If parent has no subcategories, show direct products
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {parent.products && parent.products.length > 0 ? (
                    parent.products.map((p: any) => (
                      <ProductBrandCard key={p.id} product={p} t={t} />
                    ))
                  ) : (
                    <p className="text-muted-foreground font-mono-label text-xs col-span-full py-4 ps-2">لا توجد منتجات حالياً في هذه الفئة.</p>
                  )}
                </div>
              ) : (
                // Group products inside child subcategories (families)
                <div className="space-y-8">
                  {subs.map((sub: any) => (
                    <div key={sub.id} className="bg-surface/30 border border-border/80 rounded-2xl p-6 sm:p-8 space-y-6 hover:border-primary/20 transition-all duration-300">
                      {/* Subcategory (Brand Family) Info */}
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
                        <div className="flex items-center gap-3.5">
                          <div 
                            className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-border/60 bg-surface-elevated"
                            style={{ background: gradientFromName(sub.name) }}
                          >
                            {sub.icon ? (
                              <img src={sub.icon} alt="" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="font-display text-xl leading-none italic text-foreground/90">
                                  {letterFromName(sub.name)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-display text-xl sm:text-2xl text-foreground">{sub.name}</h3>
                            <p className="text-muted-foreground font-mono-label text-[11px]">
                              {(sub.products ?? []).length} {t("Products")}
                            </p>
                          </div>
                        </div>

                        {sub.products && sub.products.length > 0 && (
                          <Link 
                            to="/shop" 
                            search={{ q: sub.name }}
                            className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            عرض كل عروض {sub.name} <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>

                      {/* Products inside this Subcategory */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {(sub.products ?? []).map((p: any) => (
                          <ProductBrandCard key={p.id} product={p} t={t} />
                        ))}
                        {(sub.products ?? []).length === 0 && (
                          <p className="text-muted-foreground font-mono-label text-xs col-span-full">لا توجد منتجات في هذه العائلة حالياً.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>

      <Footer />
    </div>
  );
}

// Brand/Product card containing all its available offers/plans
function ProductBrandCard({ product, t }: { product: any; t: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const startingPrice = lowestDzd(product.product_offers);

  return (
    <div 
      onClick={() => setIsOpen(!isOpen)}
      className="border border-border bg-surface/60 rounded-xl p-5 hover:border-primary/40 transition-all flex flex-col justify-between space-y-4 cursor-pointer select-none group"
    >
      {/* Product top branding */}
      <div className="flex gap-4">
        <div 
          className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-border bg-surface-elevated"
          style={{ background: gradientFromName(product.name) }}
        >
          {product.main_image ? (
            <img src={product.main_image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-2xl italic text-foreground/90">
                {letterFromName(product.name)}
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-display text-lg text-foreground truncate">{product.name}</h4>
            {isOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
            )}
          </div>
          <p className="text-muted-foreground text-xs line-clamp-2 mt-1 leading-relaxed">
            {product.short_description || product.description || "Curated subscription options."}
          </p>
        </div>
      </div>

      {/* Summary Info / Action when closed */}
      {!isOpen && (
        <div className="flex items-center justify-between border-t border-border/30 pt-3 text-[11px] font-mono">
          <span className="text-muted-foreground">
            {product.product_offers?.length || 0} عرض متوفر
          </span>
          <span className="text-primary hover:underline flex items-center gap-1">
            {startingPrice ? `يبدأ من: ${startingPrice.toLocaleString()} DA` : "عرض التفاصيل"}
          </span>
        </div>
      )}

      {/* Offers list under this product (revealed on open) */}
      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()} 
          className="space-y-4 pt-3 border-t border-border/30 animate-fade-in"
        >
          <div className="space-y-2.5">
            <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/60 border-b border-border/40 pb-1.5 flex justify-between">
              <span>العروض المتوفرة</span>
              {startingPrice && <span>يبدأ من: {startingPrice.toLocaleString()} DA</span>}
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {(product.product_offers ?? []).map((o: any) => {
                const outOfStock = (o.stock ?? 0) <= 0;
                
                return (
                  <div 
                    key={o.id}
                    className={`flex items-center justify-between px-3 py-2 border rounded-lg text-xs transition-colors ${
                      outOfStock 
                        ? "border-border/30 bg-surface-elevated/20 opacity-50" 
                        : "border-border/60 hover:border-primary/20 bg-background/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-display text-foreground font-medium">{o.name}</span>
                      {o.duration && (
                        <span className="text-[10px] text-muted-foreground font-mono px-1.5 py-0.5 border border-border/80 rounded bg-background">
                          {o.duration}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-primary font-medium">
                        {Number(o.price_dzd ?? 0).toLocaleString()} DA
                      </span>
                      
                      <span className={`px-1.5 py-0.5 rounded font-mono-label text-[9px] ${
                        outOfStock 
                          ? "text-destructive bg-destructive/10" 
                          : (o.stock ?? 0) < 10 
                            ? "text-amber-500 bg-amber-500/10" 
                            : "text-primary bg-primary/10"
                      }`}>
                        {outOfStock ? "منتهي" : `${o.stock} متوفر`}
                      </span>
                    </div>
                  </div>
                );
              })}
              
              {(product.product_offers ?? []).length === 0 && (
                <p className="text-muted-foreground/60 font-mono-label text-[11px] py-2">لا توجد عروض نشطة حالياً.</p>
              )}
            </div>
          </div>

          <div className="flex gap-2.5 items-center">
            {/* Button to detail page */}
            <Link 
              to="/product/$slug" 
              params={{ slug: product.slug }}
              className="flex-1 py-2 bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary-foreground border border-primary/20 hover:border-primary rounded-lg text-xs font-mono-label text-center flex items-center justify-center gap-1.5 transition-all"
            >
              تفاصيل الطلب والشراء <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-2 border border-border bg-surface/50 text-muted-foreground hover:text-foreground rounded-lg text-xs font-mono-label transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
