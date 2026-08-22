import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../../src/db/index";
import { orders } from "../../src/db/schema";

/**
 * Cashfree Webhook Handler
 * Production URL: https://saatvikannafoods.in/.netlify/functions/cashfree-webhook
 */
export default async (request: Request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const secretKey =
    (typeof Netlify !== "undefined" && Netlify.env?.get?.("CASHFREE_SECRET_KEY")) ||
    process.env.CASHFREE_SECRET_KEY;

  if (!secretKey) {
    console.error("[WEBHOOK] CASHFREE_SECRET_KEY is not configured.");
    return new Response(JSON.stringify({ error: "Server configuration error." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-webhook-timestamp");
  const signature = request.headers.get("x-webhook-signature");

  if (!timestamp || !signature) {
    console.warn("[WEBHOOK] Missing timestamp or signature headers.");
    return new Response(JSON.stringify({ error: "Missing signature headers." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Verify Timestamp (replay attack protection: 5 min window)
  const webhookTime = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(webhookTime) || Math.abs(now - webhookTime) > 300) {
    console.warn("[WEBHOOK] Timestamp out of tolerance window:", { timestamp, now });
    return new Response(JSON.stringify({ error: "Timestamp out of tolerance." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Verify HMAC-SHA256 Signature
  try {
    const signedData = `${timestamp}${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(signedData)
      .digest("base64");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const providedBuffer = Buffer.from(signature, "utf8");

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      console.warn("[WEBHOOK] Invalid webhook signature received.");
      return new Response(JSON.stringify({ error: "Invalid signature." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (sigErr) {
    console.error("[WEBHOOK] Signature check exception:", sigErr);
    return new Response(JSON.stringify({ error: "Signature verification failed." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Parse Webhook Event & Idempotent Update
  try {
    const payload = JSON.parse(rawBody);
    const eventType = payload.type || payload.event_type;
    const orderData = payload.data?.order;
    const paymentData = payload.data?.payment;

    const cashfreeOrderId = orderData?.order_id || payload.order_id;
    const paymentStatus = paymentData?.payment_status?.toUpperCase() || payload.payment_status?.toUpperCase();
    const paymentId = paymentData?.payment_id || payload.payment_id;

    if (!cashfreeOrderId) {
      console.warn("[WEBHOOK] Payload missing order_id:", payload);
      return new Response(JSON.stringify({ status: "IGNORED", reason: "Missing order_id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = getDb();
    const existingOrderRes = await db
      .select()
      .from(orders)
      .where(eq(orders.cashfreeOrderId, cashfreeOrderId))
      .limit(1);

    const existingOrder = existingOrderRes[0];

    // Idempotency: If already marked as PAID / SUCCESS, acknowledge immediately
    if (existingOrder && existingOrder.paymentStatus === "SUCCESS" && existingOrder.orderStatus === "PAID") {
      return new Response(JSON.stringify({ status: "OK", already_processed: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isSuccess =
      eventType === "PAYMENT_SUCCESS_WEBHOOK" ||
      eventType === "ORDER_PAID_WEBHOOK" ||
      paymentStatus === "SUCCESS";

    const isFailed =
      eventType === "PAYMENT_FAILED_WEBHOOK" ||
      paymentStatus === "FAILED" ||
      paymentStatus === "USER_DROPPED";

    const newPaymentStatus = isSuccess ? "SUCCESS" : isFailed ? "FAILED" : "PENDING";
    const newOrderStatus = isSuccess ? "PAID" : existingOrder?.orderStatus || "UNPAID";

    if (existingOrder) {
      const paymentGroup = paymentData?.payment_group || (paymentData?.payment_method ? Object.keys(paymentData.payment_method)[0] : null);
      await db
        .update(orders)
        .set({
          paymentStatus: newPaymentStatus,
          orderStatus: newOrderStatus,
          cashfreePaymentId: paymentId || existingOrder.cashfreePaymentId,
          paymentMethod: paymentGroup ? String(paymentGroup).toUpperCase() : null,
          bankReference: paymentData?.bank_reference ? String(paymentData.bank_reference) : null,
          paymentCompletionTime: paymentData?.payment_completion_time ? String(paymentData.payment_completion_time) : null,
          paymentMessage: paymentData?.payment_message || null,
          updatedAt: new Date(),
        })
        .where(eq(orders.cashfreeOrderId, cashfreeOrderId));
    }

    return new Response(JSON.stringify({ status: "OK", processed: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[WEBHOOK] Processing error:", err);
    return new Response(JSON.stringify({ error: "Internal processing error." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/.netlify/functions/cashfree-webhook",
};


