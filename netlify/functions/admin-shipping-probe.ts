import { requireAdminAuth } from "../../src/lib/auth";

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

  // 2. Retrieve Environment Variables
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

  const commonHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-api-key": apiKey,
    "x-api-secret": apiSecret,
  };

  try {
    const tests = [
      // 1. Literal "Order Value" with space
      {
        name: "Literal 'Order Value' with space",
        url: "https://api-v2.nimbuspost.com/v2/serviceability",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          "Order Value": 289,
          packages: [{ weight: 0.21, length: 12, width: 5, height: 25 }],
        },
      },
      // 2. Literal "order value" lowercase with space
      {
        name: "Literal 'order value' with space",
        url: "https://api-v2.nimbuspost.com/v2/serviceability",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          "order value": 289,
          packages: [{ weight: 0.21, length: 12, width: 5, height: 25 }],
        },
      },
      // 3. order_price
      {
        name: "order_price",
        url: "https://api-v2.nimbuspost.com/v2/serviceability",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          order_price: 289,
          packages: [{ weight: 0.21, length: 12, width: 5, height: 25 }],
        },
      },
      // 4. item_value inside package
      {
        name: "item_value inside package",
        url: "https://api-v2.nimbuspost.com/v2/serviceability",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          packages: [{ weight: 0.21, length: 12, width: 5, height: 25, item_value: 289, itemValue: 289, price: 289 }],
        },
      },
      // 5. Query param orderValue=289
      {
        name: "Query param orderValue=289",
        url: "https://api-v2.nimbuspost.com/v2/serviceability?orderValue=289&order_value=289&orderAmount=289",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          packages: [{ weight: 0.21, length: 12, width: 5, height: 25 }],
        },
      },
      // 6. POST /v2/couriers/serviceability
      {
        name: "POST /v2/couriers/serviceability",
        url: "https://api-v2.nimbuspost.com/v2/couriers/serviceability",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          orderAmount: 289,
          orderValue: 289,
          packages: [{ weight: 0.21, length: 12, width: 5, height: 25 }],
        },
      },
      // 7. items array inside package
      {
        name: "items array inside package",
        url: "https://api-v2.nimbuspost.com/v2/serviceability",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          packages: [
            {
              weight: 0.21,
              length: 12,
              width: 5,
              height: 25,
              items: [{ name: "Raw Makhana", price: 289, quantity: 1, value: 289 }],
            },
          ],
        },
      },
      // 8. items array at root
      {
        name: "items array at root",
        url: "https://api-v2.nimbuspost.com/v2/serviceability",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          items: [{ name: "Raw Makhana", price: 289, quantity: 1, value: 289 }],
          packages: [{ weight: 0.21, length: 12, width: 5, height: 25 }],
        },
      },
    ];

    const attempts: any[] = [];
    let successfulResponse: any = null;
    let successfulSchemaName = "";

    for (const t of tests) {
      const res = await fetch(t.url, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(t.payload),
      });

      const body = (await res.json().catch(() => ({}))) as any;
      const isSuccess = res.ok && (body.success === true || body.status === true || Array.isArray(body.data) || Array.isArray(body));

      attempts.push({
        test: t.name,
        url: t.url,
        httpStatus: res.status,
        success: isSuccess,
        detail: body.error?.detail || body.message || (isSuccess ? "SUCCESS" : JSON.stringify(body)),
        rawBody: isSuccess ? body : undefined,
      });

      if (isSuccess) {
        successfulResponse = body;
        successfulSchemaName = t.name;
        break;
      }
    }

    if (successfulResponse) {
      const rawList = Array.isArray(successfulResponse)
        ? successfulResponse
        : Array.isArray(successfulResponse.data)
        ? successfulResponse.data
        : Array.isArray(successfulResponse.data?.couriers)
        ? successfulResponse.data.couriers
        : Array.isArray(successfulResponse.data?.rates)
        ? successfulResponse.data.rates
        : [];

      return new Response(
        JSON.stringify({
          success: true,
          httpStatus: 200,
          isServiceable: rawList.length > 0,
          matchedSchema: successfulSchemaName,
          testParcel: {
            pickupPincode: 221311,
            destinationPincode: 221011,
            weightGrams: 205,
            weightKg: 0.21,
            dimensionsCm: "12 x 5 x 25",
            paymentMode: "prepaid",
            orderAmount: 289,
          },
          couriersCount: rawList.length,
          couriers: rawList,
          rawResponse: successfulResponse,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: "NimbusPost v2 serviceability sweep results.",
        attempts,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "Serviceability execution exception",
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
