import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, ShoppingBag, Truck, Package, Tag, FolderTree, Ticket,
  Users, MessageSquare, CreditCard, BarChart3, ArrowLeftRight, Bell,
  ScrollText, Settings, ShieldCheck, Menu, X,
} from "lucide-react";
import { Logo } from "../Logo";

const SECTIONS = [
  {
    label: "Operate",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { to: "/admin/delivery", label: "Delivery Center", icon: Truck },
      { to: "/admin/chats", label: "Chats", icon: MessageSquare },
      { to: "/admin/payments", label: "Payments", icon: CreditCard },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { to: "/admin/products", label: "Products", icon: Package },
      { to: "/admin/offers", label: "Offers", icon: Tag },
      { to: "/admin/categories", label: "Categories", icon: FolderTree },
      { to: "/admin/coupons", label: "Coupons", icon: Ticket },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/admin/customers", label: "Customers", icon: Users },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/admin/exchange-rate", label: "Exchange Rate", icon: ArrowLeftRight },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/notifications", label: "Notifications", icon: Bell },
      { to: "/admin/audit", label: "Audit Logs", icon: ScrollText },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

function SidebarBody({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useTranslation();
  return (
    <>
      <div className={`h-16 flex items-center border-b border-border ${compact ? "justify-center px-2 2xl:justify-between 2xl:px-6" : "justify-between px-6"}`}>
        <div className={compact ? "hidden 2xl:block" : ""}>
          <Logo />
        </div>
        <span className={`font-mono-label flex items-center gap-1.5 text-primary ${compact ? "2xl:flex" : ""}`}>
          <ShieldCheck className="w-3 h-3" /> {t("Admin")}
        </span>
      </div>
      <nav className={`flex-1 overflow-y-auto py-6 space-y-8 ${compact ? "px-2 2xl:px-3" : "px-3"}`}>
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className={`font-mono-label text-muted-foreground px-3 mb-2 ${compact ? "hidden 2xl:block" : ""}`}>{t(section.label)}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const exact = "exact" in item && item.exact;
                const active = exact ? path === item.to : path.startsWith(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={`group relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-300 ${compact ? "justify-center 2xl:justify-start" : ""}
                        ${active
                          ? "bg-surface-elevated text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated/60"
                        }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-primary shadow-glow rounded-full" />
                      )}
                      <item.icon className="w-4 h-4" />
                      <span className={`font-mono-label ${compact ? "hidden 2xl:inline" : ""}`}>{t(item.label)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className={`p-4 border-t border-border ${compact ? "hidden 2xl:block" : ""}`}>
        <Link to="/" onClick={onNavigate} className="font-mono-label text-muted-foreground hover:text-primary transition-colors">
          ← {t("Back")}
        </Link>
      </div>
    </>
  );
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const compactDesktop = path.startsWith("/admin/chats");

  return (
    <>
      {/* Desktop / tablet sidebar */}
      <aside className={`hidden md:flex flex-col shrink-0 border-r border-border bg-surface min-h-screen sticky top-0 ${compactDesktop ? "w-[72px] 2xl:w-[260px]" : "w-[220px] lg:w-[240px] xl:w-[260px]"}`}>
        <SidebarBody compact={compactDesktop} />
      </aside>

      {/* Mobile trigger */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 w-10 h-10 grid place-items-center rounded-md border border-border bg-surface/80 backdrop-blur"
        aria-label="Open menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex flex-col w-[280px] max-w-[85vw] bg-surface border-r border-border min-h-screen animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 w-8 h-8 grid place-items-center rounded-md hover:bg-surface-elevated"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarBody onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
