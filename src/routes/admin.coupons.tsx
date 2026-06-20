import { createFileRoute } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { useCoupons } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/coupons")({
  component: CouponsPage,
});

function CouponsPage() {
  const { data: coupons = [], isLoading } = useCoupons();
  const totalUses = coupons.reduce((s: number, c: any) => s + (c.used_count ?? 0), 0);
  const top = coupons.slice().sort((a: any, b: any) => (b.used_count ?? 0) - (a.used_count ?? 0))[0];

  return (
    <>
      <AdminTopbar title="Coupons" subtitle={`${coupons.length} coupons`} />
      <main className="px-6 lg:px-10 py-10 space-y-6">
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { l: "Active coupons", v: coupons.filter((c: any) => c.active).length },
            { l: "Redemptions", v: totalUses },
            { l: "Top coupon", v: top?.code ?? "—" },
          ].map((s) => (
            <div key={s.l} className="border border-border bg-surface p-6">
              <p className="font-mono-label text-muted-foreground">{s.l}</p>
              <p className="font-display text-3xl mt-3">{s.v}</p>
            </div>
          ))}
        </div>

        <div className="border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="font-mono-label text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3">Code</th>
                <th className="text-left py-3">Discount</th>
                <th className="text-right py-3">Used</th>
                <th className="text-left py-3 pl-4">Expiry</th>
                <th className="text-right px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground font-mono-label">Loading…</td></tr>}
              {!isLoading && coupons.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground font-mono-label">No coupons.</td></tr>}
              {coupons.map((c: any) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-surface-elevated/40">
                  <td className="px-6 py-4 font-mono text-primary">{c.code}</td>
                  <td className="py-4">{c.type === "percent" ? `${c.value}%` : `$${c.value}`}</td>
                  <td className="py-4 text-right font-mono">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                  <td className="py-4 pl-4 font-mono text-muted-foreground">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-mono-label px-2 py-1 rounded ${c.active ? "text-primary bg-primary/10" : "text-muted-foreground bg-surface-elevated"}`}>{c.active ? "Active" : "Inactive"}</span>
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
