import { eq, sql } from "drizzle-orm";
import { getDb } from "../../src/db/index";
import { orders } from "../../src/db/schema";
import { requireAdminAuth } from "../../src/lib/auth";
import {
  createNimbusShipment,
  assignNimbusAwb,
  getNimbusLabel,
  getNimbusManifest,
  getNimbusInvoice,
  requestNimbusPickup,
  trackNimbusShipment,
  extractNimbusErrorMessage,
} from "../../src/lib/nimbuspost";
import { getEffectiveParcelSpecs, ParcelDimensionsInput } from "../../src/data/packaging";

export default async (request: Request) => {
  // 1. Enforce Admin Authentication
  const authResult = await requireAdminAuth(request);
  if (!authResult.authenticated) {
    return authResult.errorResponse!;
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const orderId = url.searchParams.get("orderId");
  const db = getDb();

  if (!orderId) {
    return new Response(JSON.stringify({ error: "Missing orderId parameter." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch Order
  const orderRes = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = orderRes[0];

  if (!order) {
    return new Response(JSON.stringify({ error: "Order not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // -------------------------------------------------------------
  // ACTION: CREATE / RESUME SHIPMENT (POST)
  // -------------------------------------------------------------
  if (request.method === "POST" && action === "create-shipment") {
    // Check Payment Status (Only SUCCESS / PAID allowed)
    const isPaid = order.paymentStatus === "SUCCESS" || order.paymentStatus === "PAID";
    if (!isPaid) {
      return new Response(
        JSON.stringify({ error: "Shipment can only be created for PAID/SUCCESS orders." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Idempotency: Reject if AWB is already assigned
    if (order.shippingAwb && order.shippingStatus !== "BOOKING_FAILED") {
      return new Response(
        JSON.stringify({
          error: "Shipment already created.",
          message: `Order already has AWB: ${order.shippingAwb}`,
          order,
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const dimensionsOverride = (body.dimensions || {}) as ParcelDimensionsInput;

    const specs = getEffectiveParcelSpecs(order.packSize, order.quantity, dimensionsOverride);
    if (!specs.isValid) {
      return new Response(
        JSON.stringify({
          error: "PARCEL_SPECIFICATIONS_REQUIRED",
          message: "Valid packed parcel weight (>0g) and dimensions (L, W, H > 0cm) are required.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step A: Set State to BOOKING_IN_PROGRESS
    await db
      .update(orders)
      .set({
        shippingStatus: "BOOKING_IN_PROGRESS",
        parcelWeight: String(specs.weightGrams),
        parcelLength: String(specs.lengthCm),
        parcelBreadth: String(specs.breadthCm),
        parcelHeight: String(specs.heightCm),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    let shipmentId = order.shippingShipmentId;
    let nimbusOrderId = order.shippingOrderId;

    try {
      // Step B: Create NimbusPost Shipment (if not already created in a previous step)
      if (!shipmentId) {
        const createRes = await createNimbusShipment(order, dimensionsOverride);
        const isCreateSuccessful = Boolean(createRes.data?.shipment_id || createRes.status || createRes.success);

        if (!isCreateSuccessful || !createRes.data?.shipment_id) {
          await db
            .update(orders)
            .set({
              shippingStatus: "PENDING_SHIPMENT",
              shippingAwb: null,
              updatedAt: new Date(),
            })
            .where(eq(orders.id, order.id));

          const errorDetail = extractNimbusErrorMessage(createRes, "NimbusPost shipment creation was rejected by the gateway.");

          return new Response(
            JSON.stringify({
              error: "NIMBUS_BOOKING_FAILED",
              message: errorDetail,
            }),
            {
              status: 502,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        shipmentId = String(createRes.data.shipment_id);
        nimbusOrderId = String(createRes.data.order_id || "");

        // Persist NimbusPost IDs immediately
        await db
          .update(orders)
          .set({
            shippingProvider: "nimbuspost",
            shippingOrderId: nimbusOrderId,
            shippingShipmentId: shipmentId,
            shippingStatus: "NIMBUS_ORDER_CREATED",
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
      }

      // Step C: Assign Courier & Generate AWB
      const awbRes = await assignNimbusAwb(shipmentId, body.courierId || "auto");
      const awbNumber = awbRes.data?.awb_number || "";
      const courierName = awbRes.data?.courier_name || "Assigned Courier";
      const labelUrl = awbRes.data?.label || "";

      if (awbNumber) {
        const trackingUrl = `https://nimbuspost.com/track/${awbNumber}`;

        await db
          .update(orders)
          .set({
            shippingAwb: awbNumber,
            shippingCourier: courierName,
            shippingLabelUrl: labelUrl || null,
            shippingStatus: "AWB_ASSIGNED",
            trackingUrl,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));

        // Step D: Request Courier Pickup (Non-blocking)
        try {
          await requestNimbusPickup(shipmentId);
          await db
            .update(orders)
            .set({
              shippingStatus: "PICKUP_REQUESTED",
              updatedAt: new Date(),
            })
            .where(eq(orders.id, order.id));
        } catch (pickupErr) {
          console.warn("[ADMIN_SHIPPING] Pickup auto-request note:", pickupErr);
        }
      }

      const updatedOrder = (await db.select().from(orders).where(eq(orders.id, order.id)).limit(1))[0];

      return new Response(
        JSON.stringify({
          success: true,
          message: "Shipment booked and AWB assigned successfully.",
          order: updatedOrder,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (err: any) {
      console.error("[ADMIN_SHIPPING] Booking exception:", err);

      await db
        .update(orders)
        .set({
          shippingStatus: shipmentId ? "NIMBUS_ORDER_CREATED" : "PENDING_SHIPMENT",
          shippingAwb: null,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      return new Response(
        JSON.stringify({
          error: "SHIPMENT_PROCESSING_ERROR",
          message: err?.message || "Internal shipment processing error.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // -------------------------------------------------------------
  // ACTION: GET SHIPPING LABEL (GET)
  // -------------------------------------------------------------
  if (request.method === "GET" && action === "label") {
    if (!order.shippingAwb) {
      return new Response(JSON.stringify({ error: "No AWB assigned to this order." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const labelRes = await getNimbusLabel(order.shippingAwb);
      const labelUrl = labelRes.data?.label_url || order.shippingLabelUrl;

      if (labelUrl) {
        await db
          .update(orders)
          .set({ shippingLabelUrl: labelUrl, updatedAt: new Date() })
          .where(eq(orders.id, order.id));

        return new Response(JSON.stringify({ success: true, labelUrl }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Label not available from NimbusPost yet." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || "Failed to fetch label." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // -------------------------------------------------------------
  // ACTION: GET MANIFEST (GET)
  // -------------------------------------------------------------
  if (request.method === "GET" && action === "manifest") {
    if (!order.shippingAwb) {
      return new Response(JSON.stringify({ error: "No AWB assigned to this order." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const manifestRes = await getNimbusManifest(order.shippingAwb);
      const manifestUrl = manifestRes.data?.manifest_url || order.shippingManifestUrl;

      if (manifestUrl) {
        await db
          .update(orders)
          .set({ shippingManifestUrl: manifestUrl, updatedAt: new Date() })
          .where(eq(orders.id, order.id));

        return new Response(JSON.stringify({ success: true, manifestUrl }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Manifest not available yet." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || "Failed to fetch manifest." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // -------------------------------------------------------------
  // ACTION: GET INVOICE (GET)
  // -------------------------------------------------------------
  if (request.method === "GET" && action === "invoice") {
    if (!order.shippingAwb) {
      return new Response(JSON.stringify({ error: "No AWB assigned to this order." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const invoiceRes = await getNimbusInvoice(order.shippingAwb);
      const invoiceUrl = invoiceRes.data?.invoice_url || order.shippingInvoiceUrl;

      if (invoiceUrl) {
        await db
          .update(orders)
          .set({ shippingInvoiceUrl: invoiceUrl, updatedAt: new Date() })
          .where(eq(orders.id, order.id));

        return new Response(JSON.stringify({ success: true, invoiceUrl }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Invoice not available yet." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || "Failed to fetch invoice." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // -------------------------------------------------------------
  // ACTION: SYNC TRACKING STATUS (POST)
  // -------------------------------------------------------------
  if (request.method === "POST" && action === "sync-tracking") {
    if (!order.shippingAwb) {
      return new Response(JSON.stringify({ error: "No AWB assigned to this order." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const trackRes = await trackNimbusShipment(order.shippingAwb);
      const rawStatus = (trackRes.data?.current_status || "").toUpperCase();

      let mappedShippingStatus = order.shippingStatus;

      if (rawStatus.includes("DELIVERED")) {
        mappedShippingStatus = "DELIVERED";
      } else if (rawStatus.includes("OUT_FOR_DELIVERY") || rawStatus.includes("OUT FOR DELIVERY")) {
        mappedShippingStatus = "OUT_FOR_DELIVERY";
      } else if (rawStatus.includes("IN_TRANSIT") || rawStatus.includes("IN TRANSIT") || rawStatus.includes("REACHED")) {
        mappedShippingStatus = "IN_TRANSIT";
      } else if (rawStatus.includes("PICKED_UP") || rawStatus.includes("PICKED UP") || rawStatus.includes("PICKED") || rawStatus.includes("MANIFEST")) {
        mappedShippingStatus = "PICKED_UP";
      } else if (rawStatus.includes("RTO")) {
        mappedShippingStatus = "RTO";
      }

      await db
        .update(orders)
        .set({
          shippingStatus: mappedShippingStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      const updatedOrder = (await db.select().from(orders).where(eq(orders.id, order.id)).limit(1))[0];

      return new Response(
        JSON.stringify({
          success: true,
          tracking: trackRes.data,
          order: updatedOrder,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || "Failed to sync tracking." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Invalid action or method." }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  path: "/.netlify/functions/admin-shipping",
};
