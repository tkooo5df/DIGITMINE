import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTranslation } from "react-i18next";

const STEPS = [
  "Pick a product",
  "Pay via BaridiMob or Binance",
  "Upload your receipt",
  "Chat with the team",
  "Receive your product",
];

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
});

function HowItWorksPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-6 py-24 w-full">
        <p className="font-mono-label text-muted-foreground mb-4">{t("The process")}</p>
        <h1 className="font-display text-5xl md:text-7xl mb-16">
          {t("Five steps,")}<br /><span className="italic text-primary">{t("no surprises.")}</span>
        </h1>
        <ol className="space-y-8 max-w-2xl">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-6 border-b border-border pb-8">
              <span className="font-mono-label text-primary shrink-0 pt-2">0{i + 1}</span>
              <div>
                <h3 className="font-display text-2xl">{t(s)}</h3>
              </div>
            </li>
          ))}
        </ol>
      </main>
      <Footer />
    </div>
  );
}
