import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adjustOfferStock, setOfferStock } from "./stock.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Unauthorized");
}

export const adminSetOfferStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      offerId: z.string().uuid(),
      stock: z.number().int().min(0).max(999999),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const result = await setOfferStock(data.offerId, data.stock);
    if (!result.ok) throw new Error(result.error);
    return { stock: result.stock };
  });

export const adminAdjustOfferStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      offerId: z.string().uuid(),
      delta: z.number().int().min(-999999).max(999999),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const result = await adjustOfferStock(data.offerId, data.delta);
    if (!result.ok) throw new Error(result.error);
    return { stock: result.stock };
  });
