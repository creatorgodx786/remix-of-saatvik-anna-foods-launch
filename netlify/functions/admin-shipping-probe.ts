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
    const keysToTest = [
      "order_value",
      "orderValue",
      "order_amount",
      "orderAmount",
      "order_total",
      "orderTotal",
      "total_amount",
      "totalAmount",
      "invoice_value",
      "invoiceValue",
      "declared_value",
      "declaredValue",
      "package_value",
      "packageValue",
      "shipment_value",
      "shipmentValue",
      "product_value",
      "productValue",
      "collectable_value",
      "collectableValue",
      "goods_value",
      "goodsValue",
    ];

    const endpointsToTest = [
      "https://api-v2.nimbuspost.com/v2/serviceability",
      "https://api-v2.nimbuspost.com/v2/couriers/serviceability",
      "https://api-v2.nimbuspost.com/v2/rates",
      "https://api-v2.nimbuspost.com/v2/rate-calculator",
    ];

    const attempts: any[] = [];
    let successfulResponse: any = null;
    let successfulSchemaName = "";

    // Test each key with /v2/serviceability
    for (const key of keysToTest) {
      const payload: any = {
        pickupPincode: 221311,
        deliveryPincode: 221011,
        paymentMode: "prepaid",
        packages: [
          {
            weight: 0.21,
            length: 12,
            width: 5,
            height: 25,
          },
        ],
      };
      payload[key] = 289;

      const res = await fetch("https://api-v2.nimbuspost.com/v2/serviceability", {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(payload),
      });

      const body = (await res.json().catch(() => ({}))) as any;
      const isSuccess = res.ok && (body.success === true || body.status === true || Array.isArray(body.data) || Array.isArray(body));

      attempts.push({
        key,
        httpStatus: res.status,
        success: isSuccess,
        detail: body.error?.detail || body.message || (isSuccess ? "SUCCESS" : JSON.stringify(body)),
      });

      if (isSuccess) {
        successfulResponse = body;
        successfulSchemaName = `Key: ${key}`;
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
        message: "NimbusPost v2 key sweep results.",
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
