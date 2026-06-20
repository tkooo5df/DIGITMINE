import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-6 py-24 w-full">
        <h1 className="font-display text-5xl md:text-7xl">{t("Cart")}</h1>
        <p className="text-muted-foreground mt-6">{t("Your cart is empty.")}</p>
      </main>
      <Footer />
    </div>
  );
}
