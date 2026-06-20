import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { useOffers } from "@/lib/admin-data";
import { adminAdjustOfferStock, adminSetOfferStock } from "@/lib/stock.functions";

export const Route = createFileRoute("/admin/offers")({
  component: OffersPage,
});

function stockClass(stock: number) {
  if (stock <= 0) return "text-destructive";
  if (stock < 10) return "text-amber-400";
  return "text-primary";
}

function StockCell({ offerId, initialStock, productId }: { offerId: string; initialStock: number; productId: string }) {
  const qc = useQueryClient();
  const [stock, setStock] = useState(initialStock);
  const [draft, setDraft] = useState(String(initialStock));
  const [saving, setSaving] = useState(false);

  async function refresh(stockValue: number) {
    setStock(stockValue);
    setDraft(String(stockValue));
    await qc.invalidateQueries({ queryKey: ["admin"] });
  }

  async function save() {
    setSaving(true);
    try {
      const result = await adminSetOfferStock({ data: { offerId, stock: Number(draft) || 0 } });
      await refresh(result.stock);
    } finally {
      setSaving(false);
    }
  }

  async function bump(delta: number) {
    setSaving(true);
    try {
      const result = await adminAdjustOfferStock({ data: { offerId, delta } });
      await refresh(result.stock);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2 min-w-[140px]">
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={saving}
          onClick={() => bump(-1)}
          className="w-7 h-7 border border-border text-xs hover:bg-surface-elevated disabled:opacity-50"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          className="w-16 h-7 px-2 text-center font-mono text-sm bg-surface border border-border"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => bump(1)}
          className="w-7 h-7 border border-border text-xs hover:bg-surface-elevated disabled:opacity-50"
        >
          +
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => bump(10)}
          className="px-2 py-0.5 text-[10px] font-mono-label border border-border hover:bg-surface-elevated disabled:opacity-50"
        >
          +10
        </button>
        <button
          type="button"
          disabled={saving || Number(draft) === stock}
          onClick={save}
          className="px-2 py-0.5 text-[10px] font-mono-label bg-primary/15 text-primary border border-primary/30 disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
        <Link
          to="/admin/products/$id"
          params={{ id: productId }}
          className="text-[10px] font-mono-label text-muted-foreground hover:text-foreground"
        >
          Edit
        </Link>
      </div>
      <span className={`font-mono text-xs ${stockClass(stock)}`}>
        {stock <= 0 ? "Out of stock" : stock < 10 ? "Low stock" : "In stock"}
      </span>
    </div>
  );
}

function OffersPage() {
  const { data: offers = [], isLoading } = useOffers();

  return (
    <>
      <AdminTopbar title="Product Offers & Stock" subtitle={`${offers.length} offers — stock syncs to Telegram & website`} />
      <main className="px-6 lg:px-10 py-10">
        <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
          Manage inventory per offer. Stock updates in Supabase are reflected immediately in the Telegram bot catalog and on the website.
        </p>
        <div className="border border-border bg-surface overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="font-mono-label text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3">Product</th>
                <th className="text-left py-3">Offer</th>
                <th className="text-left py-3">Duration</th>
                <th className="text-right py-3">DZD</th>
                <th className="text-right py-3 pr-6">Stock</th>
                <th className="text-left py-3 pl-4">Supplier</th>
                <th className="text-right px-6 py-3">Active</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground font-mono-label">Loading…</td></tr>}
              {!isLoading && offers.length === 0 && <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground font-mono-label">No offers.</td></tr>}
              {offers.map((o: any) => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-surface-elevated/40">
                  <td className="px-6 py-4">{o.products?.name}</td>
                  <td className="py-4 text-muted-foreground">{o.name}</td>
                  <td className="py-4 font-mono-label text-muted-foreground">{o.duration ?? "—"}</td>
                  <td className="py-4 text-right font-mono">{Number(o.price_dzd ?? 0).toLocaleString()} DA</td>
                  <td className="py-4 pr-6">
                    <StockCell offerId={o.id} initialStock={Number(o.stock ?? 0)} productId={o.product_id} />
                  </td>
                  <td className="py-4 pl-4 font-mono-label text-muted-foreground">{o.supplier ?? "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-block w-9 h-5 rounded-full p-0.5 ${o.active ? "bg-primary" : "bg-border"}`}>
                      <span className={`block w-4 h-4 rounded-full bg-background transition-transform ${o.active ? "translate-x-4" : ""}`} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
