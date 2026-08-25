import { requireAdminAuth } from "../../src/lib/auth";
import { getDb } from "../../src/db/index";
import { orders } from "../../src/db/schema";
import { eq } from "drizzle-orm";

const DEPLOY_TIMESTAMP = new Date().toISOString();

export default async (request: Request) => {
  // 1. Enforce Probe Key or Admin Auth
  const probeHeader = request.headers.get("x-probe-token");
  const isProbeValid = probeHeader && probeHeader === "saf_nimbus_probe_9f83a02b1c4e7d5";

  if (!isProbeValid) {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authenticated) {
      return authResult.errorResponse!;
    }
  }

  try {
    const db = getDb();
    const orderRes = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, "SAF-2026-1001"))
      .limit(1);

    const order = orderRes[0] || null;

    return new Response(
      JSON.stringify({
        success: true,
        deployTimestamp: DEPLOY_TIMESTAMP,
        orderData: order
          ? {
              id: order.id,
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              totalAmount: order.totalAmount,
              paymentStatus: order.paymentStatus,
              orderStatus: order.orderStatus,
              shiprocketStatus: order.shiprocketStatus,
              shiprocketAwb: order.shiprocketAwb,
              shippingProvider: order.shippingProvider,
              shippingOrderId: order.shippingOrderId,
              shippingShipmentId: order.shippingShipmentId,
              shippingAwb: order.shippingAwb,
              shippingCourier: order.shippingCourier,
              shippingStatus: order.shippingStatus,
              parcelWeight: order.parcelWeight,
              parcelLength: order.parcelLength,
              parcelBreadth: order.parcelBreadth,
              parcelHeight: order.parcelHeight,
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
            }
          : null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "DB inspection error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const config = {
  path: "/.netlify/functions/admin-shipping-probe",
};
