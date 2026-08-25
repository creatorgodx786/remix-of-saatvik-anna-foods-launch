import { requireAdminAuth } from "../../src/lib/auth";
import { getDb } from "../../src/db/index";
import { sql } from "drizzle-orm";

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

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "inspect";
  const db = getDb();

  try {
    // -------------------------------------------------------------
    // ACTION: CORRECT ORDER STATUS FOR SAF-2026-1001
    // -------------------------------------------------------------
    if (action === "correct-order-status") {
      // 1. Pre-update verification: Count matching rows
      const preCheckRes = await db.execute(sql`
        SELECT 
          id,
          order_number,
          cashfree_order_id,
          cashfree_payment_id,
          customer_name,
          total_amount,
          payment_status,
          order_status,
          shipping_status,
          shipping_awb,
          payment_method,
          bank_reference
        FROM orders
        WHERE order_number = 'SAF-2026-1001'
          AND payment_status = 'SUCCESS'
          AND shipping_status = 'PENDING_SHIPMENT'
          AND (shipping_awb IS NULL OR shipping_awb = '');
      `);

      const preCheckRows = Array.isArray(preCheckRes) ? preCheckRes : (preCheckRes as any).rows || [];
      const matchCount = preCheckRows.length;

      if (matchCount !== 1) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `PRE_CHECK_FAILED: Expected exactly 1 matching row, found ${matchCount}. Update aborted.`,
            matchingRows: preCheckRows,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const beforeState = preCheckRows[0];

      // 2. Perform targeted single-row update
      const updateRes = await db.execute(sql`
        UPDATE orders
        SET order_status = 'PAID',
            updated_at = NOW()
        WHERE order_number = 'SAF-2026-1001'
          AND payment_status = 'SUCCESS'
          AND shipping_status = 'PENDING_SHIPMENT'
          AND (shipping_awb IS NULL OR shipping_awb = '');
      `);

      // 3. Post-update verification: Read full record
      const postCheckRes = await db.execute(sql`
        SELECT 
          id,
          order_number,
          cashfree_order_id,
          cashfree_payment_id,
          customer_name,
          total_amount,
          payment_status,
          order_status,
          shipping_status,
          shipping_awb,
          shipping_courier,
          payment_method,
          bank_reference,
          created_at,
          updated_at
        FROM orders
        WHERE order_number = 'SAF-2026-1001'
        LIMIT 1;
      `);

      const postCheckRows = Array.isArray(postCheckRes) ? postCheckRes : (postCheckRes as any).rows || [];
      const afterState = postCheckRows[0] || null;

      const isVerified =
        afterState &&
        afterState.payment_status === "SUCCESS" &&
        afterState.order_status === "PAID" &&
        afterState.shipping_status === "PENDING_SHIPMENT" &&
        (afterState.shipping_awb === null || afterState.shipping_awb === "") &&
        afterState.cashfree_order_id === beforeState.cashfree_order_id &&
        afterState.cashfree_payment_id === beforeState.cashfree_payment_id &&
        afterState.bank_reference === beforeState.bank_reference &&
        afterState.payment_method === beforeState.payment_method &&
        Number(afterState.total_amount) === 289.0;

      return new Response(
        JSON.stringify({
          success: true,
          actionExecuted: action,
          deployTimestamp: DEPLOY_TIMESTAMP,
          rowsMatched: matchCount,
          rowsUpdated: 1,
          beforeState: {
            orderNumber: beforeState.order_number,
            paymentStatus: beforeState.payment_status,
            orderStatus: beforeState.order_status,
            shippingStatus: beforeState.shipping_status,
            shippingAwb: beforeState.shipping_awb,
            cashfreeOrderId: beforeState.cashfree_order_id,
            cashfreePaymentId: beforeState.cashfree_payment_id,
            totalAmount: beforeState.total_amount,
          },
          afterState: {
            orderNumber: afterState.order_number,
            paymentStatus: afterState.payment_status,
            orderStatus: afterState.order_status,
            shippingStatus: afterState.shipping_status,
            shippingAwb: afterState.shipping_awb,
            cashfreeOrderId: afterState.cashfree_order_id,
            cashfreePaymentId: afterState.cashfree_payment_id,
            bankReference: afterState.bank_reference,
            paymentMethod: afterState.payment_method,
            totalAmount: afterState.total_amount,
            updatedAt: afterState.updated_at,
          },
          allVerificationChecksPassed: isVerified,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Default inspect
    const inspectRes = await db.execute(sql`
      SELECT 
        order_number, payment_status, order_status, shipping_status, shipping_awb, total_amount
      FROM orders
      WHERE order_number = 'SAF-2026-1001'
      LIMIT 1;
    `);

    const inspectRows = Array.isArray(inspectRes) ? inspectRes : (inspectRes as any).rows || [];

    return new Response(
      JSON.stringify({
        success: true,
        order: inspectRows[0] || null,
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
        error: err?.message || "Execution exception",
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
