import { createFileRoute } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { useCustomers } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const { data: customers = [], isLoading } = useCustomers();
  return (
    <>
      <AdminTopbar title="Customers" subtitle={`${customers.length} customers`} />
      <main className="px-6 lg:px-10 py-10">
        <div className="border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="font-mono-label text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3">Customer</th>
                <th className="text-left py-3">Phone</th>
                <th className="text-right py-3">Orders</th>
                <th className="text-right py-3">Spent</th>
                <th className="text-right px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground font-mono-label">Loading…</td></tr>}
              {!isLoading && customers.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground font-mono-label">No customers yet.</td></tr>}
              {customers.map((c: any) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-surface-elevated/40">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-primary/5 grid place-items-center font-mono text-xs">
                      {(c.full_name || "?")[0].toUpperCase()}
                    </span>
                    {c.full_name || "Unnamed"}
                  </td>
                  <td className="py-4 text-muted-foreground font-mono text-xs">{c.phone || "—"}</td>
                  <td className="py-4 text-right font-mono">{c.orders}</td>
                  <td className="py-4 text-right font-mono text-primary">${c.spent.toFixed(0)}</td>
                  <td className="px-6 py-4 text-right">
                    {c.banned ? (
                      <span className="font-mono-label px-2 py-1 rounded text-destructive bg-destructive/10">Banned</span>
                    ) : c.spent > 100 ? (
                      <span className="font-mono-label px-2 py-1 rounded text-primary bg-primary/10">VIP</span>
                    ) : null}
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
