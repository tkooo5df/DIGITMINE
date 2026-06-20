import { createFileRoute } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { useAuditLogs, timeAgo } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  const { data: audit = [], isLoading } = useAuditLogs();
  return (
    <>
      <AdminTopbar title="Audit Logs" subtitle="Admin actions trail" />
      <main className="px-6 lg:px-10 py-10">
        <div className="border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="font-mono-label text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3">Admin</th>
                <th className="text-left py-3">Action</th>
                <th className="text-left py-3">Target</th>
                <th className="text-left py-3">IP</th>
                <th className="text-right px-6 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground font-mono-label">Loading…</td></tr>}
              {!isLoading && audit.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground font-mono-label">No audit entries.</td></tr>}
              {audit.map((a) => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-surface-elevated/40">
                  <td className="px-6 py-4 font-mono text-xs">{(a.admin_id ?? "system").slice(0, 8)}</td>
                  <td className="py-4 capitalize">{a.action.replace(/_/g, " ")}</td>
                  <td className="py-4 text-primary font-mono text-xs">{a.target_id}</td>
                  <td className="py-4 font-mono text-xs text-muted-foreground">{a.ip ?? "—"}</td>
                  <td className="px-6 py-4 text-right font-mono-label text-muted-foreground">{timeAgo(a.created_at)} ago</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
