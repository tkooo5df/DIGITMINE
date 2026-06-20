import { createFileRoute } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Sparkline, StatCard } from "@/components/admin/StatCard";
import { useOrders, useProducts } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data: orders = [] } = useOrders();
  const { data: products = [] } = useProducts();

  const revenue = orders.reduce((s: number, o: any) => s + Number(o.total_usd), 0);
  const refunded = orders.filter((o: any) => o.status === "refunded").length;
  const refundRate = orders.length ? ((refunded / orders.length) * 100).toFixed(1) : "0";

  // Top sellers
  const byProduct = new Map<string, { name: string; units: number; rev: number }>();
  for (const o of orders as any[]) {
    const name = o.products?.name ?? "Unknown";
    const cur = byProduct.get(name) ?? { name, units: 0, rev: 0 };
    cur.units += o.quantity;
    cur.rev += Number(o.total_usd);
    byProduct.set(name, cur);
  }
  const top = Array.from(byProduct.values()).sort((a, b) => b.rev - a.rev).slice(0, 5);

  return (
    <>
      <AdminTopbar title="Analytics" subtitle="All-time" />
      <main className="px-6 lg:px-10 py-10 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Revenue" value={`$${revenue.toFixed(0)}`} trend="live" up />
          <StatCard label="Orders" value={String(orders.length)} trend="live" up />
          <StatCard label="Products" value={String(products.length)} trend="active" up />
          <StatCard label="Refunds" value={`${refundRate}%`} trend="rate" up={refunded === 0} />
        </div>

        <div className="grid lg:grid-cols-2 gap-3">
          {["Revenue trend", "Orders trend", "Coupon performance", "Delivery time (median)"].map((title) => (
            <div key={title} className="border border-border bg-surface p-6">
              <p className="font-mono-label text-muted-foreground mb-4">{title}</p>
              <Sparkline />
            </div>
          ))}
        </div>

        <div className="border border-border bg-surface">
          <header className="px-6 py-4 border-b border-border">
            <h3 className="font-display text-xl">Top sellers</h3>
          </header>
          <table className="w-full text-sm">
            <thead className="font-mono-label text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3">Product</th>
                <th className="text-right py-3">Units</th>
                <th className="text-right px-6 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {top.length === 0 && <tr><td colSpan={3} className="px-6 py-10 text-center text-muted-foreground font-mono-label">No sales data.</td></tr>}
              {top.map((t) => (
                <tr key={t.name} className="border-b border-border/50">
                  <td className="px-6 py-4">{t.name}</td>
                  <td className="py-4 text-right font-mono">{t.units}</td>
                  <td className="px-6 py-4 text-right font-mono text-primary">${t.rev.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
