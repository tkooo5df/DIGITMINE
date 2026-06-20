import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/support")({
  component: SupportPage,
});

function SupportPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-6 py-24 w-full">
        <p className="font-mono-label text-muted-foreground mb-4">{t("We're here")}</p>
        <h1 className="font-display text-5xl md:text-7xl">
          {t("Talk to")} <span className="italic text-primary">{t("a human.")}</span>
        </h1>
        <div className="mt-16 grid md:grid-cols-2 gap-6 max-w-3xl">
          <a href="#" className="border border-border p-8 hover:border-primary/50 transition-all">
            <p className="font-mono-label text-muted-foreground mb-2">{t("Channel 01")}</p>
            <h3 className="font-display text-3xl">WhatsApp</h3>
            <p className="text-muted-foreground mt-3">{t("Fastest reply, business hours Algiers.")}</p>
          </a>
          <a href="#" className="border border-border p-8 hover:border-primary/50 transition-all">
            <p className="font-mono-label text-muted-foreground mb-2">{t("Channel 02")}</p>
            <h3 className="font-display text-3xl">Telegram</h3>
            <p className="text-muted-foreground mt-3">{t("Async, attachments welcome.")}</p>
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}
