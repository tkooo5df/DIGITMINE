import { Bell, Search, ShieldCheck, Plus } from "lucide-react";
import { LanguageSwitch } from "@/components/LanguageSwitch";

import { useTranslation } from "react-i18next";

export function AdminTopbar({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
      <div className="h-16 px-6 lg:px-10 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 lg:hidden" />
          <div className="min-w-0">
            <h1 className="font-display text-lg leading-none truncate">{t(title)}</h1>
            {subtitle && <p className="font-mono-label text-muted-foreground mt-1 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-1.5 w-72">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              placeholder={t("Search") + "…"}
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground"
            />
            <span className="font-mono-label text-muted-foreground">⌘K</span>
          </div>
          <LanguageSwitch />
          <button className="relative w-9 h-9 grid place-items-center rounded-md border border-border hover:border-primary/40 transition-colors">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary shadow-glow" />
          </button>
          {action ?? (
            <button className="hidden md:inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 font-mono-label hover:shadow-glow transition-all">
              <Plus className="w-3.5 h-3.5" /> {t("Add")}
            </button>
          )}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 border border-border grid place-items-center font-mono text-xs">
            AV
          </div>
        </div>
      </div>
    </header>
  );
}
