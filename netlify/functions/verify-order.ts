const CASHFREE_API_VERSION = "2023-08-01";

async function fetchFromCashfree(
  endpoint: string,
  appId: string,
  secretKey: string
): Promise<{ ok: boolean; status: number; text: () => Promise<string> }> {
  const urlStr = "https://api.cashfree.com/pg" + endpoint;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-api-version": CASHFREE_API_VERSION,
    "x-client-id": appId,
    "x-client-secret": secretKey,
  };

  try {
    const res = await fetch(urlStr, {
      method: "GET",
      headers,
    });
    return res;
  } catch (fetchErr) {
    const url = new URL(urlStr);
    const dns = await import("node:dns/promises");
    const resolver = new dns.Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1"]);
    const ips = await resolver.resolve4(url.hostname).catch(() => [url.hostname]);
    const https = await import("node:https");

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          host: ips[0],
          servername: url.hostname,
          path: url.pathname + url.search,
          method: "GET",
          headers: {
            ...headers,
            Host: url.hostname,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () =>
            resolve({
              ok: (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300,
              status: res.statusCode ?? 500,
              text: () => Promise.resolve(data),
            })
          );
        }
      );
      req.on("error", reject);
      req.end();
    });
  }
}

export default async (request: Request) => {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    let orderId: string | null = null;

    if (request.method === "GET") {
      const url = new URL(request.url);
      orderId = url.searchParams.get("order_id") || url.searchParams.get("orderId");
    } else {
      const body = await request.json().catch(() => ({}));
      orderId = body.order_id || body.orderId || null;
    }

    if (!orderId || !orderId.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing order_id parameter." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const appId =
      (typeof Netlify !== "undefined" && Netlify.env?.get?.("CASHFREE_APP_ID")) ||
      process.env.CASHFREE_APP_ID;
    const secretKey =
      (typeof Netlify !== "undefined" && Netlify.env?.get?.("CASHFREE_SECRET_KEY")) ||
      process.env.CASHFREE_SECRET_KEY;

    if (!appId || !secretKey) {
      return new Response(
        JSON.stringify({ error: "Cashfree API credentials are not configured." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const cleanOrderId = orderId.trim();
    const orderRes = await fetchFromCashfree("/orders/" + encodeURIComponent(cleanOrderId), appId, secretKey);
    const orderText = await orderRes.text();

    let orderData: any;
    try {
      orderData = JSON.parse(orderText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Unable to parse order status from Cashfree." }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!orderRes.ok) {
      return new Response(
        JSON.stringify({
          error: orderData?.message || "Order not found in Cashfree.",
          status: "FAILED",
        }),
        {
          status: orderRes.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    let payments: any[] = [];
    try {
      const paymentsRes = await fetchFromCashfree("/orders/" + encodeURIComponent(cleanOrderId) + "/payments", appId, secretKey);
      const paymentsText = await paymentsRes.text();
      const parsed = JSON.parse(paymentsText);
      if (Array.isArray(parsed)) {
        payments = parsed;
      }
    } catch {}

    const orderStatus = String(orderData.order_status || "").toUpperCase();
    const hasSuccessPayment = payments.some(
      (p) => String(p.payment_status || "").toUpperCase() === "SUCCESS"
    );
    const latestPayment = payments[payments.length - 1];
    const latestStatus = latestPayment ? String(latestPayment.payment_status || "").toUpperCase() : null;

    const hasSuccess = orderStatus === "PAID" || hasSuccessPayment;
    const isExplicitlyPending =
      !hasSuccess &&
      payments.length > 0 &&
      (latestStatus === "PENDING" || latestStatus === "IN_PROGRESS" || latestStatus === "FLAGGED");

    let computedStatus: "SUCCESS" | "FAILED" | "PENDING";
    let message: string;

    if (hasSuccess) {
      computedStatus = "SUCCESS";
      message = "Payment completed successfully.";
    } else if (isExplicitlyPending) {
      computedStatus = "PENDING";
      message = "Payment confirmation is pending from your bank.";
    } else {
      computedStatus = "FAILED";
      message =
        latestPayment?.payment_message ||
        (latestStatus === "USER_DROPPED"
          ? "Payment was cancelled by user."
          : "Payment was not completed or was declined.");
    }

    // Update order status in PostgreSQL database
    try {
      const { eq } = await import("drizzle-orm");
      const { getDb } = await import("../../src/db/index");
      const { orders } = await import("../../src/db/schema");
      const db = getDb();

      const existingOrderRes = await db
        .select()
        .from(orders)
        .where(eq(orders.cashfreeOrderId, cleanOrderId))
        .limit(1);

      const existingOrder = existingOrderRes[0];
      const newOrderStatus = hasSuccess ? "PAID" : existingOrder?.orderStatus || "UNPAID";

      if (existingOrder) {
        const paymentGroup = latestPayment?.payment_group || (latestPayment?.payment_method ? Object.keys(latestPayment.payment_method)[0] : null);
        await db
          .update(orders)
          .set({
            paymentStatus: computedStatus,
            orderStatus: newOrderStatus,
            cashfreePaymentId: latestPayment?.payment_id || existingOrder.cashfreePaymentId,
            paymentMethod: paymentGroup ? String(paymentGroup).toUpperCase() : null,
            bankReference: latestPayment?.bank_reference ? String(latestPayment.bank_reference) : null,
            paymentCompletionTime: latestPayment?.payment_completion_time ? String(latestPayment.payment_completion_time) : null,
            paymentMessage: latestPayment?.payment_message || message || null,
            updatedAt: new Date(),
          })
          .where(eq(orders.cashfreeOrderId, cleanOrderId));
      }
    } catch (dbErr) {
      console.error("[VERIFY_ORDER] DB update error:", dbErr);
    }

    return new Response(
      JSON.stringify({
        status: computedStatus,
        order_status: orderStatus,
        payment_status: latestStatus || orderStatus,
        message,
        order_id: orderData.order_id,
        order_amount: orderData.order_amount,
        order_currency: orderData.order_currency || "INR",
        order_tags: orderData.order_tags || {},
        customer: {
          name: orderData.customer_details?.customer_name || "",
          phone: orderData.customer_details?.customer_phone || "",
          email: orderData.customer_details?.customer_email || "",
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("verify-order error:", err);
    return new Response(
      JSON.stringify({
        error: "Unable to verify order status.",
        details: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const config = {
  path: "/.netlify/functions/verify-order",
};
