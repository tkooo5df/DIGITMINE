import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { ProductCard } from "./ProductCard";
import { lowestDzd, useCatalogProducts } from "@/lib/catalog-data";

export function TrendingCarousel() {
  const { t } = useTranslation();
  const { data: products = [] } = useCatalogProducts();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const trending = [...products]
    .sort((a, b) => (b.sales_count ?? 0) - (a.sales_count ?? 0))
    .slice(0, 12);

  if (trending.length === 0) return null;

  const scroll = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14">
      <div className="flex items-end justify-between mb-5 gap-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="font-display text-lg sm:text-2xl">
            {t("Most ordered")}
          </h2>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            onClick={() => scroll(-1)}
            className="p-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            aria-label={t("Previous")}
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          </button>
          <button
            onClick={() => scroll(1)}
            className="p-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            aria-label={t("Next")}
          >
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {trending.map((p) => (
          <div
            key={p.slug}
            className="snap-start shrink-0 w-[44%] sm:w-[28%] md:w-[22%] lg:w-[18%]"
          >
            <ProductCard
              name={p.name}
              category={p.categories?.name ?? t("Digital")}
              priceDzd={lowestDzd(p.product_offers)}
              slug={p.slug}
              image={p.main_image}
              offers={p.product_offers}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
