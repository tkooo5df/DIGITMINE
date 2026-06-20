import crypto from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** All the Binance Pay fields a transaction ID might match against */
function matchTx(tx: any, id: string): boolean {
  const needle = id.trim().toLowerCase();
  const fields = [
    tx.prepayId,
    tx.transactionId,
    tx.orderId,
    tx.merchantTradeNo,
    tx.openUserId,
  ];
  return fields.some(
    (f) => f != null && String(f).trim().toLowerCase() === needle
  );
}

export async function verifyBinanceTransaction(
  transactionId: string,
  expectedUsd: number,
  locale: string = "ar"
): Promise<{ ok: boolean; message: string }> {
  const isAr = locale === "ar";

  const messages = {
    keysNotConfigured: isAr
      ? "نظام التحقق التلقائي من Binance غير مهيأ حالياً. يرجى الاتصال بالدعم الفني."
      : "Binance automated verification is not configured. Please contact support.",
    alreadyUsed: isAr
      ? "معرف المعاملة هذا تم استخدامه مسبقاً في طلب آخر."
      : "This Transaction ID has already been used in another order.",
    apiError: (details: string) =>
      isAr
        ? `فشل الاتصال بخدمة التحقق من Binance: ${details}`
        : `Failed to communicate with Binance verification service: ${details}`,
    permissionError: isAr
      ? "مفاتيح Binance API لا تملك صلاحية قراءة معاملات Binance Pay. يرجى التأكد من تفعيل صلاحية 'Binance Pay' في إعدادات API."
      : "Binance API keys lack permission for Binance Pay transactions. Please enable 'Binance Pay' permission in your Binance API settings.",
    invalidResponse: isAr
      ? "استجابة غير صالحة من منصة Binance."
      : "Invalid response received from Binance.",
    notFound: isAr
      ? "لم يتم العثور على معرف المعاملة في قائمة آخر 90 يوم من معاملات Binance Pay. تأكد من أن المعرف صحيح وأن الدفع تم بالفعل."
      : "Transaction ID not found in the last 90 days of Binance Pay transactions. Verify the ID is correct and the payment was completed.",
    notSuccess: (status: string) =>
      isAr
        ? `حالة المعاملة ليست ناجحة (الحالة الحالية: ${status}). يرجى إكمال الدفع أولاً.`
        : `Transaction status is not SUCCESS (current status: ${status}). Please complete the payment first.`,
    amountMismatch: (amount: number, currency: string, expected: number) =>
      isAr
        ? `مبلغ المعاملة (${amount} ${currency}) لا يتطابق مع مبلغ الطلب (${expected} USD). الفرق المسموح به هو 5%.`
        : `Transaction amount (${amount} ${currency}) does not match order amount (${expected} USD). Allowed margin is 5%.`,
    success: isAr
      ? "✅ تم التحقق من الدفع بنجاح عبر Binance API."
      : "✅ Payment verified successfully via Binance API.",
  };

  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.warn("[Binance] API keys not configured");
    return { ok: false, message: messages.keysNotConfigured };
  }

  // 1. Prevent replay attacks — check if this txid was already used
  const { data: existing } = await supabaseAdmin
    .from("payment_receipts")
    .select("id")
    .eq("file_path", `txid:${transactionId.trim()}`)
    .maybeSingle();

  if (existing) {
    return { ok: false, message: messages.alreadyUsed };
  }

  // 2. Call Binance Pay transaction history API
  try {
    const timestamp = Date.now();
    const recvWindow = 10000;
    // Fetch up to 100 recent transactions (max allowed)
    const queryString = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(queryString)
      .digest("hex");

    const url = `https://api.binance.com/sapi/v1/pay/transactions?${queryString}&signature=${signature}`;
    console.log("[Binance] Calling Pay transactions API...");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/json",
      },
    });

    const rawText = await response.text();

    if (!response.ok) {
      console.error("[Binance API] HTTP error:", response.status, rawText);
      // 403 / -2015 = invalid key, -1002 = unauthorized
      if (response.status === 403 || rawText.includes("-2015") || rawText.includes("-1002")) {
        return { ok: false, message: messages.permissionError };
      }
      return { ok: false, message: messages.apiError(`HTTP ${response.status}`) };
    }

    let result: any;
    try {
      result = JSON.parse(rawText);
    } catch {
      console.error("[Binance] Failed to parse JSON:", rawText.slice(0, 200));
      return { ok: false, message: messages.invalidResponse };
    }

    // Binance Pay API error codes
    if (result.code !== "000000") {
      console.error("[Binance] API error code:", result.code, result.message);
      if (result.code === "400202" || result.code === "-2015") {
        return { ok: false, message: messages.permissionError };
      }
      return { ok: false, message: result.message ?? messages.invalidResponse };
    }

    if (!Array.isArray(result.data)) {
      console.error("[Binance] Unexpected data shape:", JSON.stringify(result).slice(0, 200));
      return { ok: false, message: messages.invalidResponse };
    }

    console.log(`[Binance] Got ${result.data.length} transactions, searching for txid: ${transactionId}`);

    // 3. Search all ID fields (prepayId, transactionId, orderId, merchantTradeNo)
    const tx = result.data.find((item: any) => matchTx(item, transactionId));

    if (!tx) {
      console.warn("[Binance] Transaction not found. IDs available:", 
        result.data.slice(0, 5).map((t: any) => ({
          prepayId: t.prepayId,
          transactionId: t.transactionId,
          orderId: t.orderId,
        }))
      );
      return { ok: false, message: messages.notFound };
    }

    console.log("[Binance] Found transaction:", JSON.stringify(tx));

    // 4. Verify status
    if (tx.status !== "SUCCESS") {
      return { ok: false, message: messages.notSuccess(tx.status) };
    }

    // 5. Verify amount with 5% tolerance
    const txAmount = parseFloat(String(tx.amount ?? tx.totalFee ?? 0));
    const diff = Math.abs(txAmount - expectedUsd);
    const maxMargin = Math.max(expectedUsd * 0.05, 0.5); // at least 0.5 USD margin

    if (diff > maxMargin) {
      return {
        ok: false,
        message: messages.amountMismatch(txAmount, tx.currency ?? "USDT", expectedUsd),
      };
    }

    return { ok: true, message: messages.success };
  } catch (error: any) {
    console.error("[Binance Verify Error]:", error);
    return { ok: false, message: messages.apiError(error.message ?? "Unknown error") };
  }
}
