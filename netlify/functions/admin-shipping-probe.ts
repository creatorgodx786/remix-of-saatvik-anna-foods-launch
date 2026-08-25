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
    // ACTION: RUN ADDITIVE MIGRATION
    // -------------------------------------------------------------
    if (action === "apply-migration") {
      // 1. Provider-Neutral Shipping Fields
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_provider" text;`);
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_order_id" text;`);
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_shipment_id" text;`);
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_awb" text;`);
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_courier" text;`);
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_status" text DEFAULT 'PENDING_SHIPMENT';`);
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_label_url" text;`);
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_manifest_url" text;`);
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_invoice_url" text;`);
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_url" text;`);

      // 2. Actual Packed Parcel Specifications
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "parcel_weight" numeric(10, 2);`);
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "parcel_length" numeric(10, 2);`);
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "parcel_breadth" numeric(10, 2);`);
      await db.execute(sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "parcel_height" numeric(10, 2);`);

      // 3. Webhook Deduplication Table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "webhook_events" (
          "id" text PRIMARY KEY NOT NULL,
          "provider" text NOT NULL,
          "event_type" text NOT NULL,
          "payload_hash" text NOT NULL,
          "processed_at" timestamp with time zone DEFAULT now() NOT NULL
        );
      `);

      // 4. Indexes for Rapid Status & Webhook Queries
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_orders_shipping_awb" ON "orders" ("shipping_awb");`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_orders_shipping_status" ON "orders" ("shipping_status");`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_orders_shipping_provider" ON "orders" ("shipping_provider");`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_webhook_events_provider" ON "webhook_events" ("provider");`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_webhook_events_processed_at" ON "webhook_events" ("processed_at" DESC);`);
    }

    // -------------------------------------------------------------
    // POST-MIGRATION READ-ONLY VERIFICATION
    // -------------------------------------------------------------
    // A. Verify Columns in 'orders' table
    const columnsRes = await db.execute(sql`
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'orders'
      ORDER BY ordinal_position;
    `);

    const ordersColumns = Array.isArray(columnsRes) ? columnsRes : (columnsRes as any).rows || [];
    const columnNamesList = ordersColumns.map((c: any) => String(c.column_name || "").toLowerCase());

    const targetColumns = [
      "shipping_provider",
      "shipping_order_id",
      "shipping_shipment_id",
      "shipping_awb",
      "shipping_courier",
      "shipping_status",
      "shipping_label_url",
      "shipping_manifest_url",
      "shipping_invoice_url",
      "tracking_url",
      "parcel_weight",
      "parcel_length",
      "parcel_breadth",
      "parcel_height",
    ];

    const columnStatusMap: Record<string, boolean> = {};
    for (const col of targetColumns) {
      columnStatusMap[col] = columnNamesList.includes(col);
    }

    const allTargetColumnsPresent = targetColumns.every((col) => columnStatusMap[col]);

    // B. Verify 'webhook_events' Table
    const tableRes = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'webhook_events';
    `);

    const webhookTableRows = Array.isArray(tableRes) ? tableRes : (tableRes as any).rows || [];
    const hasWebhookEventsTable = webhookTableRows.length > 0;

    // C. Verify Order SAF-2026-1001 Data Integrity
    const orderRes = await db.execute(sql`
      SELECT 
        id,
        order_number,
        cashfree_order_id,
        cashfree_payment_id,
        customer_name,
        customer_phone,
        total_amount,
        payment_status,
        order_status,
        shipping_provider,
        shipping_order_id,
        shipping_shipment_id,
        shipping_awb,
        shipping_courier,
        shipping_status,
        parcel_weight,
        parcel_length,
        parcel_breadth,
        parcel_height,
        payment_method,
        bank_reference,
        created_at,
        updated_at
      FROM orders 
      WHERE order_number = 'SAF-2026-1001'
      LIMIT 1;
    `);

    const orderRows = Array.isArray(orderRes) ? orderRes : (orderRes as any).rows || [];
    const safOrder = orderRows[0] || null;

    return new Response(
      JSON.stringify({
        success: true,
        actionExecuted: action,
        deployTimestamp: DEPLOY_TIMESTAMP,
        migrationStatus: {
          isApplied: allTargetColumnsPresent && hasWebhookEventsTable,
          all14ColumnsPresent: allTargetColumnsPresent,
          hasWebhookEventsTable,
          columnsChecklist: columnStatusMap,
        },
        orderIntegrityCheck: safOrder
          ? {
              orderFound: true,
              orderNumber: safOrder.order_number,
              customerName: safOrder.customer_name,
              totalAmount: safOrder.total_amount,
              paymentStatus: safOrder.payment_status,
              orderStatus: safOrder.order_status,
              shippingAwb: safOrder.shipping_awb,
              shippingStatus: safOrder.shipping_status,
              cashfreeOrderId: safOrder.cashfree_order_id,
              cashfreePaymentId: safOrder.cashfree_payment_id,
              bankReference: safOrder.bank_reference,
              paymentMethod: safOrder.payment_method,
              createdAt: safOrder.created_at,
              checksPass:
                safOrder.payment_status === "SUCCESS" &&
                safOrder.order_status === "PAID" &&
                safOrder.shipping_awb === null,
            }
          : { orderFound: false },
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
        error: err?.message || "Migration execution error",
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
