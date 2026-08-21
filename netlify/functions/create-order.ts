const CASHFREE_API_VERSION = "2023-08-01";

export default async (request: Request) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const body = await request.json();

    const amount = Number(body.amount);
    const packSize = String(body.packSize || "");
    const quantity = Number(body.quantity || 1);
    const customer = body.customer || {};

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid order amount." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!customer.name || !customer.phone) {
      return new Response(
        JSON.stringify({
          error: "Customer name and phone are required.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const appId = Netlify.env.get("CASHFREE_APP_ID");
    const secretKey = Netlify.env.get("CASHFREE_SECRET_KEY");

    if (!appId || !secretKey) {
      return new Response(
        JSON.stringify({
          error: "Cashfree API credentials are not configured.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const orderId = `SAATVIK_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    const siteUrl = "https://saatvikannafoods.in";

    const cashfreeResponse = await fetch(
      "https://sandbox.cashfree.com/pg/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-version": CASHFREE_API_VERSION,
          "x-client-id": appId,
          "x-client-secret": secretKey,
          "x-request-id": orderId,
        },
        body: JSON.stringify({
          order_id: orderId,
          order_amount: Number(amount.toFixed(2)),
          order_currency: "INR",

          customer_details: {
            customer_id: `customer_${customer.phone.replace(/\D/g, "")}`,
            customer_name: customer.name.trim(),
            customer_phone: customer.phone.replace(/\D/g, ""),
            customer_email: customer.email ? customer.email.trim() : "customer@example.com",
          },

          order_meta: {
            return_url: `${siteUrl}/?order_id={order_id}`,
          },

          order_note: `${quantity} x ${packSize} Raw Makhana`,

          order_tags: {
            product: "Raw Makhana",
            pack_size: packSize,
            quantity: String(quantity),
            address: String(customer.address || ""),
            city: String(customer.city || ""),
            state: String(customer.state || ""),
            pincode: String(customer.pincode || ""),
          },
        }),
      }
    );

    const responseText = await cashfreeResponse.text();

    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({
          error: "Cashfree returned a non-JSON response.",
          cashfree_status: cashfreeResponse.status,
          cashfree_response: responseText.substring(0, 1000),
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!cashfreeResponse.ok) {
      return new Response(
        JSON.stringify({
          error:
            data?.message ||
            data?.error ||
            "Cashfree could not create the order.",
          cashfree_status: cashfreeResponse.status,
          cashfree_response: data,
        }),
        {
          status: cashfreeResponse.status,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!data?.payment_session_id) {
      return new Response(
        JSON.stringify({
          error: "Cashfree did not return a payment session ID.",
          cashfree_response: data,
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        order_id: data.order_id,
        payment_session_id: data.payment_session_id,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unable to create payment order.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};

export const config = {
  path: "/.netlify/functions/create-order",
};
