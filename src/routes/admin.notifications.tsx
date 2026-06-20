import { createFileRoute } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { useNotifications, timeAgo } from "@/lib/admin-data";
import { ShoppingBag, Receipt, AlertTriangle, MessageSquare, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/notifications")({
  component: NotifPage,
});

const ICONS: Record<string, any> = {
  order: ShoppingBag, receipt: Receipt, stock: AlertTriangle, dispute: MessageSquare,
};

function NotifPage() {
  const { data: notifs = [], isLoading } = useNotifications();
  const qc = useQueryClient();
  const unread = notifs.filter((n: any) => !n.read).length;

  const markAllRead = async () => {
    const ids = notifs.filter((n: any) => !n.read).map((n: any) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ read: true }).in("id", ids);
    qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
  };

  return (
    <>
      <AdminTopbar title="Notifications" subtitle={`${unread} unread`} />
      <main className="px-6 lg:px-10 py-10">
        <div className="flex justify-end mb-6">
          <button onClick={markAllRead} className="font-mono-label text-muted-foreground hover:text-primary">Mark all read</button>
        </div>
        {isLoading && <p className="text-center text-muted-foreground font-mono-label">Loading…</p>}
        {!isLoading && notifs.length === 0 && <p className="text-center text-muted-foreground font-mono-label py-12">No notifications.</p>}
        <ul className="border border-border bg-surface divide-y divide-border">
          {notifs.map((n: any) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <li key={n.id} className={`flex gap-4 px-6 py-4 hover:bg-surface-elevated/40 ${!n.read ? "bg-surface-elevated/30" : ""}`}>
                <div className="w-9 h-9 rounded-md bg-surface-elevated grid place-items-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>}
                  <p className="font-mono-label text-muted-foreground mt-1">{timeAgo(n.created_at)} ago</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-primary shadow-glow self-center" />}
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
