import { getDb } from "../../src/db/index";
import { orders } from "../../src/db/schema";
import { eq, sql } from "drizzle-orm";
import { BRAND, CONTACT } from "../../src/data/site";

const DEPLOY_TIMESTAMP = new Date().toISOString();

export default async (request: Request) => {
  // 1. Enforce Probe Key Authentication
  const probeHeader = request.headers.get("x-probe-token");
  const isProbeValid = probeHeader && probeHeader === "saf_nimbus_probe_9f83a02b1c4e7d5";

  if (!isProbeValid) {
    return new Response(JSON.stringify({ error: "Unauthorized probe execution." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Retrieve Environment Variables in Netlify Runtime
  const netlifyEnv = (globalThis as any).Netlify?.env;
  const rawApiKey = (
    (typeof netlifyEnv?.get === "function" && netlifyEnv.get("NIMBUSPOST_API_KEY")) ||
    process.env["NIMBUSPOST_API_KEY"] ||
    ""
  );

  const rawApiSecret = (
    (typeof netlifyEnv?.get === "function" && netlifyEnv.get("NIMBUSPOST_API_SECRET")) ||
    process.env["NIMBUSPOST_API_SECRET"] ||
    ""
  );

  const apiKey = rawApiKey.trim().replace(/^["']|["']$/g, "");
  const apiSecret = rawApiSecret.trim().replace(/^["']|["']$/g, "");

  if (!apiKey || !apiSecret) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Missing NimbusPost API credentials in environment.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const db = getDb();

  try {
    // 3. Pre-execution Check: Fetch order SAF-2026-1001
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, "SAF-2026-1001"))
      .limit(1);

    const existingOrder = orderRows[0];
    if (!existingOrder) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Order SAF-2026-1001 not found in database.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const preState = {
      orderNumber: existingOrder.orderNumber,
      totalAmount: existingOrder.totalAmount,
      paymentStatus: existingOrder.paymentStatus,
      orderStatus: existingOrder.orderStatus,
      shippingStatus: existingOrder.shippingStatus,
      shippingAwb: existingOrder.shippingAwb,
    };

    // 4. Construct Exact Verified Payload for SAF-2026-1001
    // Specs: 100g -> 0.1 kg, 20x15x10 cm, ₹289, Prepaid
    const shipmentPayload = {
      order_number: "SAF-2026-1001",
      order_type: "b2c",
      shipping_charges: 0,
      discount: 0,
      cod_charges: 0,
      payment_type: "prepaid",
      order_amount: 289,
      packages: [
        {
          weight: 0.1,
          length: 20,
          width: 15,
          height: 10,
        },
      ],
      request_auto_pickup: "no",
      consignee: {
        name: (existingOrder.customerName || "Suraj Rajput").trim(),
        address: (existingOrder.shippingAddress || "VRINDAVAN APPARTMENT, CHITAIPUR, SUSWAHI").trim(),
        address_2: "",
        city: (existingOrder.city || "VARANASI").trim(),
        state: (existingOrder.state || "UTTAR PRADESH").trim(),
        pincode: (existingOrder.pincode || "221011").trim(),
        phone: (existingOrder.customerPhone || "7238965234").trim(),
        email: existingOrder.customerEmail ? existingOrder.customerEmail.trim() : "care@saatvikannafoods.in",
      },
      pickup: {
        warehouse_name: BRAND.name,
        name: "Suraj Singh",
        address: CONTACT.addressLines.join(" "),
        city: "Varanasi",
        state: "Uttar Pradesh",
        pincode: "221311",
        phone: CONTACT.phone,
      },
      order_items: [
        {
          name: `${existingOrder.productName || "Raw Makhana"} (${existingOrder.packSize || "200g"})`,
          qty: Math.max(1, existingOrder.quantity || 1),
          price: 289,
          sku: "SAF-MAKHANA-200G",
        },
      ],
    };

    // 5. Invoke Exactly ONE POST https://api-v2.nimbuspost.com/v2/shipments
    const startTime = Date.now();
    const res = await fetch("https://api-v2.nimbuspost.com/v2/shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": apiKey,
        "x-api-secret": apiSecret,
      },
      body: JSON.stringify(shipmentPayload),
    });
    const durationMs = Date.now() - startTime;

    const rawResponseBody = await res.text();
    let parsedBody: any = null;
    try {
      parsedBody = JSON.parse(rawResponseBody);
    } catch {
      parsedBody = { raw: rawResponseBody };
    }

    const isSuccess = res.ok && (parsedBody.status === true || parsedBody.success === true || Boolean(parsedBody.data?.shipment_id));
    let awbNumber: string | null = null;
    let shipmentId: string | null = null;
    let nimbusOrderId: string | null = null;
    let dbUpdated = false;

    if (isSuccess && parsedBody.data) {
      shipmentId = parsedBody.data.shipment_id ? String(parsedBody.data.shipment_id) : null;
      nimbusOrderId = parsedBody.data.order_id ? String(parsedBody.data.order_id) : null;
      awbNumber = parsedBody.data.awb_number || parsedBody.data.awb || null;

      if (shipmentId) {
        await db
          .update(orders)
          .set({
            shippingProvider: "nimbuspost",
            shippingOrderId: nimbusOrderId,
            shippingShipmentId: shipmentId,
            shippingAwb: awbNumber,
            shippingStatus: "NIMBUS_ORDER_CREATED",
            parcelWeight: "100",
            parcelLength: "20",
            parcelBreadth: "15",
            parcelHeight: "10",
            updatedAt: new Date(),
          })
          .where(eq(orders.id, existingOrder.id));
        dbUpdated = true;
      }
    } else {
      // Revert/leave as PENDING_SHIPMENT and NULL AWB as required by Rule 7
      await db
        .update(orders)
        .set({
          shippingStatus: "PENDING_SHIPMENT",
          shippingAwb: null,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, existingOrder.id));
    }

    // 6. Fetch post-execution state from database
    const postRows = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, "SAF-2026-1001"))
      .limit(1);

    const postState = postRows[0]
      ? {
          orderNumber: postRows[0].orderNumber,
          totalAmount: postRows[0].totalAmount,
          paymentStatus: postRows[0].paymentStatus,
          orderStatus: postRows[0].orderStatus,
          shippingStatus: postRows[0].shippingStatus,
          shippingAwb: postRows[0].shippingAwb,
          shippingOrderId: postRows[0].shippingOrderId,
          shippingShipmentId: postRows[0].shippingShipmentId,
        }
      : null;

    return new Response(
      JSON.stringify({
        success: isSuccess,
        deployTimestamp: DEPLOY_TIMESTAMP,
        durationMs,
        httpStatus: res.status,
        httpStatusText: res.statusText,
        sentPayload: shipmentPayload,
        nimbusResponseBody: parsedBody,
        awbReturned: awbNumber,
        shipmentIdReturned: shipmentId,
        nimbusOrderIdReturned: nimbusOrderId,
        databaseUpdated: dbUpdated,
        pickupScheduled: false,
        preExecutionState: preState,
        postExecutionState: postState,
      }),
      {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "Internal probe execution error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/.netlify/functions/admin-shipping-probe",
};
