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

  try {
    const db = getDb();

    // 1. Query all columns in the 'orders' table
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

    // 2. Check if 'webhook_events' table exists
    const tableRes = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'webhook_events';
    `);

    const webhookTableRows = Array.isArray(tableRes) ? tableRes : (tableRes as any).rows || [];
    const hasWebhookEventsTable = webhookTableRows.length > 0;

    // 3. Check for specific fulfillment columns
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

    return new Response(
      JSON.stringify({
        success: true,
        deployTimestamp: DEPLOY_TIMESTAMP,
        schemaVerification: {
          ordersTableFound: ordersColumns.length > 0,
          totalColumnsInOrdersTable: ordersColumns.length,
          allFulfillmentColumnsPresent: allTargetColumnsPresent,
          hasWebhookEventsTable,
          isMigrationApplied: allTargetColumnsPresent && hasWebhookEventsTable,
          columnsChecklist: columnStatusMap,
          allExistingOrdersColumns: ordersColumns.map((c: any) => ({
            name: c.column_name,
            type: c.data_type,
            nullable: c.is_nullable,
            default: c.column_default,
          })),
        },
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
        error: err?.message || "Schema inspection error",
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
