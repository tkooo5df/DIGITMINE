import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border mt-32">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
          <div>
            <h4 className="font-mono-label text-muted-foreground mb-4">{t("Shop")}</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/shop" className="hover:text-primary">{t("View all")}</a></li>
              <li><a href="/categories" className="hover:text-primary">{t("Categories")}</a></li>
              <li><a href="/shop" className="hover:text-primary">{t("Most ordered")}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono-label text-muted-foreground mb-4">{t("Account")}</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/profile" className="hover:text-primary">{t("Profile")}</a></li>
              <li><a href="/chats" className="hover:text-primary">{t("Orders")}</a></li>
              <li><a href="/auth" className="hover:text-primary">{t("Sign in")}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono-label text-muted-foreground mb-4">{t("Support")}</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/how-it-works" className="hover:text-primary">{t("How it works")}</a></li>
              <li><a href="/support" className="hover:text-primary">{t("Support")}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono-label text-muted-foreground mb-4">{t("Legal")}</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-primary">{t("Terms")}</a></li>
              <li><a href="#" className="hover:text-primary">{t("Privacy")}</a></li>
              <li><a href="#" className="hover:text-primary">{t("Refunds")}</a></li>
            </ul>
          </div>
        </div>
        <div className="flex items-end justify-between border-t border-border pt-8">
          <h2 className="font-display text-6xl md:text-9xl uppercase leading-none">
            DIGIT<span className="text-primary">MINE</span>
          </h2>
          <p className="font-mono-label text-muted-foreground text-right">
            © 2026<br />{t("All rights reserved")}
          </p>
        </div>
      </div>
    </footer>
  );
}
