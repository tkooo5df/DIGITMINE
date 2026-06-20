import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { StatCard, Sparkline } from "@/components/admin/StatCard";
import { useDashboardStats, useOrders, useAuditLogs, STATUS_COLOR, timeAgo } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats } = useDashboardStats();
  const { data: orders = [], isLoading } = useOrders();
  const { data: audit = [] } = useAuditLogs();

  const cards = stats
    ? [
        { label: "Revenue USD", value: `$${stats.usd.toFixed(0)}`, trend: "+8.2%", up: true },
        { label: "Revenue DZD", value: stats.dzd.toLocaleString(), trend: "+11.4%", up: true },
        { label: "Orders today", value: String(stats.ordersToday), trend: `+${stats.ordersToday}`, up: true },
        { label: "Pending payments", value: String(stats.pending), trend: "live", up: false },
        { label: "Processing", value: String(stats.processing), trend: "live", up: true },
        { label: "Completed", value: String(stats.completed), trend: "all-time", up: true },
      ]
    : [];

  return (
    <>
      <AdminTopbar title="Dashboard" subtitle={`${new Date().toDateString()} — operations overview`} />
      <main className="px-6 lg:px-10 py-10 space-y-12">
        <section>
          <p className="font-mono-label text-muted-foreground mb-4">Today</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {cards.map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        </section>

        <section className="grid lg:grid-cols-3 gap-3">
          {[
            { title: "Revenue", note: stats ? `$${stats.usd.toFixed(0)} total` : "" },
            { title: "Orders", note: `${orders.length} all-time` },
            { title: "Conversion", note: "—" },
          ].map((c) => (
            <div key={c.title} className="border border-border bg-surface p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono-label text-muted-foreground">{c.title}</p>
                <p className="font-mono text-xs text-primary">{c.note}</p>
              </div>
              <Sparkline />
            </div>
          ))}
        </section>

        <section className="grid lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 border border-border bg-surface">
            <header className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-display text-xl">Recent orders</h3>
              <Link to="/admin/orders" className="font-mono-label text-muted-foreground hover:text-primary">View all →</Link>
            </header>
            <table className="w-full text-sm">
              <thead className="font-mono-label text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3">Order</th>
                  <th className="text-left py-3">Product</th>
                  <th className="text-right py-3">USD</th>
                  <th className="text-right px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground font-mono-label">Loading…</td></tr>}
                {!isLoading && orders.length === 0 && <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground font-mono-label">No orders yet.</td></tr>}
                {orders.slice(0, 6).map((o: any) => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-surface-elevated/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-primary">{o.order_number}</td>
                    <td className="py-4 text-muted-foreground">{o.products?.name}</td>
                    <td className="py-4 text-right font-mono">${o.total_usd}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-mono-label px-2 py-1 rounded ${STATUS_COLOR[o.status]}`}>{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border border-border bg-surface">
            <header className="px-6 py-4 border-b border-border">
              <h3 className="font-display text-xl">Activity</h3>
            </header>
            <ul className="divide-y divide-border">
              {audit.length === 0 && <li className="px-6 py-10 text-center text-muted-foreground font-mono-label">No activity.</li>}
              {audit.slice(0, 8).map((a) => (
                <li key={a.id} className="px-6 py-4 flex gap-4">
                  <span className="font-mono-label text-muted-foreground w-10 shrink-0">{timeAgo(a.created_at)}</span>
                  <span className="text-sm">{a.action.replace(/_/g, " ")} — <span className="text-primary">{a.target_id}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
