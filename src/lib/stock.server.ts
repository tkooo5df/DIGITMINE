// Offer stock helpers — shared by Telegram bot, website orders, and admin.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getOfferStock(offerId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("product_offers")
    .select("stock")
    .eq("id", offerId)
    .eq("active", true)
    .maybeSingle();
  return Number(data?.stock ?? 0);
}

export async function tryDecrementOfferStock(
  offerId: string,
  quantity = 1,
): Promise<{ ok: true; stock: number } | { ok: false; error: string }> {
  const { data: row } = await supabaseAdmin
    .from("product_offers")
    .select("stock")
    .eq("id", offerId)
    .eq("active", true)
    .maybeSingle();

  const current = Number(row?.stock ?? 0);
  if (current < quantity) return { ok: false, error: "Out of stock" };

  const { data: updated, error } = await supabaseAdmin
    .from("product_offers")
    .update({ stock: current - quantity })
    .eq("id", offerId)
    .eq("stock", current)
    .select("stock")
    .maybeSingle();

  if (error || !updated) return { ok: false, error: "Out of stock" };
  return { ok: true, stock: Number(updated.stock) };
}

export async function adjustOfferStock(
  offerId: string,
  delta: number,
): Promise<{ ok: true; stock: number } | { ok: false; error: string }> {
  const { data: row } = await supabaseAdmin
    .from("product_offers")
    .select("stock")
    .eq("id", offerId)
    .maybeSingle();

  if (!row) return { ok: false, error: "Offer not found" };
  const next = Math.max(0, Number(row.stock ?? 0) + delta);

  const { data: updated, error } = await supabaseAdmin
    .from("product_offers")
    .update({ stock: next })
    .eq("id", offerId)
    .select("stock")
    .single();

  if (error || !updated) return { ok: false, error: error?.message ?? "Update failed" };
  return { ok: true, stock: Number(updated.stock) };
}

export async function setOfferStock(
  offerId: string,
  stock: number,
): Promise<{ ok: true; stock: number } | { ok: false; error: string }> {
  const value = Math.max(0, Math.floor(stock));
  const { data: updated, error } = await supabaseAdmin
    .from("product_offers")
    .update({ stock: value })
    .eq("id", offerId)
    .select("stock")
    .single();

  if (error || !updated) return { ok: false, error: error?.message ?? "Update failed" };
  return { ok: true, stock: Number(updated.stock) };
}
