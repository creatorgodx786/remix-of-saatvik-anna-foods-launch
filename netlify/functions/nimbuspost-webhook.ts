import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../../src/db/index";
import { orders, webhookEvents } from "../../src/db/schema";
import { verifyNimbusWebhook } from "../../src/lib/nimbuspost";

export default async (request: Request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await request.text().catch(() => "");
  const authHeader = request.headers.get("authorization") || request.headers.get("x-nimbus-signature") || "";

  // 1. Verify Webhook Signature / Secret
  const isValid = verifyNimbusWebhook(authHeader, rawBody);
  if (!isValid && process.env.NODE_ENV === "production") {
    console.warn("[NIMBUS_WEBHOOK] Unauthorized webhook attempt.");
    return new Response(JSON.stringify({ error: "Unauthorized webhook." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Webhook Deduplication / Idempotency Guard
  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  const eventId = String(body.event_id || body.id || `np_evt_${payloadHash}`);
  const eventType = String(body.event || body.event_type || body.status || "STATUS_UPDATE");

  const db = getDb();

  try {
    const existingEvent = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.id, eventId))
      .limit(1);

    if (existingEvent[0]) {
      // Already processed, return 200 OK immediately
      return new Response(JSON.stringify({ success: true, message: "Event already processed." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Record event in deduplication table
    await db.insert(webhookEvents).values({
      id: eventId,
      provider: "nimbuspost",
      eventType,
      payloadHash,
    });
  } catch (dedupErr) {
    console.warn("[NIMBUS_WEBHOOK] Deduplication record notice:", dedupErr);
  }

  // 3. Process Shipping Status Updates (Strictly Shipping Fields ONLY)
  const awb = String(body.awb || body.awb_number || body.data?.awb || "").trim();
  const statusStr = String(body.current_status || body.status || body.data?.status || "").toUpperCase();

  if (awb) {
    let newShippingStatus: string | undefined;

    if (statusStr.includes("DELIVERED")) {
      newShippingStatus = "DELIVERED";
    } else if (statusStr.includes("OUT_FOR_DELIVERY") || statusStr.includes("OUT FOR DELIVERY")) {
      newShippingStatus = "OUT_FOR_DELIVERY";
    } else if (statusStr.includes("IN_TRANSIT") || statusStr.includes("IN TRANSIT") || statusStr.includes("REACHED")) {
      newShippingStatus = "IN_TRANSIT";
    } else if (statusStr.includes("PICKED_UP") || statusStr.includes("PICKED UP") || statusStr.includes("PICKUP")) {
      newShippingStatus = "PICKED_UP";
    } else if (statusStr.includes("RTO")) {
      newShippingStatus = "RTO";
    }

    if (newShippingStatus) {
      // Strictly update shippingStatus and updatedAt ONLY. Never touch paymentStatus, paymentMethod, or orderStatus.
      await db
        .update(orders)
        .set({
          shippingStatus: newShippingStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.shippingAwb, awb));

      console.log(`[NIMBUS_WEBHOOK] Updated AWB ${awb} to shipping_status = ${newShippingStatus}`);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  path: "/.netlify/functions/nimbuspost-webhook",
};
