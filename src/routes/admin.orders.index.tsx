import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { useOrders, STATUS_COLOR, timeAgo } from "@/lib/admin-data";
import { Filter, Download } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/orders/")({
  component: OrdersPage,
});

const FILTERS = ["All", "pending", "submitted", "verified", "processing", "delivered", "completed", "disputed"];

function OrdersPage() {
  const { data: orders = [], isLoading } = useOrders();
  const [filter, setFilter] = useState("All");

  const filtered = filter === "All" ? orders : orders.filter((o: any) => o.status === filter);
  const pending = orders.filter((o: any) => ["pending", "submitted"].includes(o.payment_status)).length;

  return (
    <>
      <AdminTopbar title="Orders" subtitle={`${orders.length} orders · ${pending} pending`} />
      <main className="px-6 lg:px-10 py-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`font-mono-label px-3 py-1.5 rounded-md border transition-all capitalize ${filter === f ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 font-mono-label px-3 py-1.5 border border-border rounded-md hover:border-primary/30">
              <Filter className="w-3 h-3" /> Filters
            </button>
            <button className="flex items-center gap-2 font-mono-label px-3 py-1.5 border border-border rounded-md hover:border-primary/30">
              <Download className="w-3 h-3" /> Export
            </button>
          </div>
        </div>

        <div className="border border-border bg-surface overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="font-mono-label text-muted-foreground sticky top-0 bg-surface">
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3">Order</th>
                <th className="text-left py-3">Product / Offer</th>
                <th className="text-right py-3">Qty</th>
                <th className="text-right py-3">USD</th>
                <th className="text-right py-3">DZD</th>
                <th className="text-left py-3 pl-4">Method</th>
                <th className="text-left py-3">Delivery</th>
                <th className="text-right px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="px-6 py-10 text-center text-muted-foreground font-mono-label">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={8} className="px-6 py-10 text-center text-muted-foreground font-mono-label">No orders match.</td></tr>}
              {filtered.map((o: any) => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-surface-elevated/40 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs">
                    <Link to="/admin/orders/$id" params={{ id: o.id }} className="text-primary hover:underline">
                      {o.order_number}
                    </Link>
                    <div className="text-muted-foreground mt-1">{timeAgo(o.created_at)} ago</div>
                  </td>
                  <td className="py-4">
                    <div>{o.products?.name}</div>
                    <div className="text-muted-foreground text-xs">{o.product_offers?.name}</div>
                  </td>
                  <td className="py-4 text-right font-mono">{o.quantity}</td>
                  <td className="py-4 text-right font-mono">${o.total_usd}</td>
                  <td className="py-4 text-right font-mono text-muted-foreground">{Number(o.total_dzd).toLocaleString()}</td>
                  <td className="py-4 pl-4 font-mono-label capitalize">{o.payment_method}</td>
                  <td className="py-4 font-mono-label text-muted-foreground">{o.delivery_type}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-mono-label px-2 py-1 rounded ${STATUS_COLOR[o.status]}`}>{o.status}</span>
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
