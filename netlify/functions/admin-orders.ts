import { eq, desc, and, or, ilike, sql } from "drizzle-orm";
import { getDb } from "../../src/db/index";
import { orders } from "../../src/db/schema";
import { requireAdminAuth } from "../../src/lib/auth";

export default async (request: Request) => {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authenticated) {
    return authResult.errorResponse!;
  }

  const url = new URL(request.url);
  const db = getDb();

  // 1. GET / - List orders or single order detail
  if (request.method === "GET") {
    const id = url.searchParams.get("id");

    // Single order detail
    if (id) {
      const orderRes = await db
        .select()
        .from(orders)
        .where(or(eq(orders.id, id), eq(orders.orderNumber, id), eq(orders.cashfreeOrderId, id)))
        .limit(1);

      const order = orderRes[0];
      if (!order) {
        return new Response(JSON.stringify({ error: "Order not found." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ order }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // List orders with search, filters, pagination, and metrics
    const query = url.searchParams.get("q")?.trim() || "";
    const paymentStatus = url.searchParams.get("paymentStatus")?.trim();
    const orderStatus = url.searchParams.get("orderStatus")?.trim();
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(orders.orderNumber, `%${query}%`),
          ilike(orders.customerName, `%${query}%`),
          ilike(orders.customerPhone, `%${query}%`),
          ilike(orders.customerEmail, `%${query}%`),
          ilike(orders.cashfreeOrderId, `%${query}%`)
        )
      );
    }

    if (paymentStatus && paymentStatus !== "ALL") {
      conditions.push(eq(orders.paymentStatus, paymentStatus));
    }

    if (orderStatus && orderStatus !== "ALL") {
      conditions.push(eq(orders.orderStatus, orderStatus));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countRes, metricsRes] = await Promise.all([
      db
        .select()
        .from(orders)
        .where(whereClause)
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)` })
        .from(orders)
        .where(whereClause),
      db
        .select({
          totalOrders: sql<number>`count(*)`,
          totalRevenue: sql<string>`coalesce(sum(case when payment_status = 'SUCCESS' then total_amount else 0 end), 0)`,
          paidOrders: sql<number>`count(case when payment_status = 'SUCCESS' then 1 end)`,
          pendingOrders: sql<number>`count(case when payment_status = 'PENDING' then 1 end)`,
          failedOrders: sql<number>`count(case when payment_status = 'FAILED' or payment_status = 'USER_DROPPED' then 1 end)`,
          pendingShipments: sql<number>`count(case when payment_status = 'SUCCESS' and (order_status = 'PAID' or order_status = 'PROCESSING') then 1 end)`,
        })
        .from(orders),
    ]);

    const total = Number(countRes[0]?.total || 0);
    const metrics = {
      totalOrders: Number(metricsRes[0]?.totalOrders || 0),
      totalRevenue: Number(metricsRes[0]?.totalRevenue || 0),
      paidOrders: Number(metricsRes[0]?.paidOrders || 0),
      pendingOrders: Number(metricsRes[0]?.pendingOrders || 0),
      failedOrders: Number(metricsRes[0]?.failedOrders || 0),
      pendingShipments: Number(metricsRes[0]?.pendingShipments || 0),
    };

    return new Response(
      JSON.stringify({
        orders: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        metrics,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // 2. PATCH /?id=... - Update order status, fulfillment status, or AWB
  if (request.method === "PATCH") {
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing order id parameter." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const updateData: Partial<typeof orders.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (body.orderStatus) {
        updateData.orderStatus = String(body.orderStatus);
      }
      if (body.shiprocketStatus) {
        updateData.shiprocketStatus = String(body.shiprocketStatus);
      }
      if (body.shiprocketAwb !== undefined) {
        updateData.shiprocketAwb = body.shiprocketAwb ? String(body.shiprocketAwb) : null;
      }

      await db
        .update(orders)
        .set(updateData)
        .where(eq(orders.id, id));

      const updatedOrderRes = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

      return new Response(JSON.stringify({ success: true, order: updatedOrderRes[0] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("[ADMIN_ORDERS] Update error:", err);
      return new Response(JSON.stringify({ error: "Unable to update order." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed." }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  path: "/.netlify/functions/admin-orders",
};


