import { requireAdminAuth } from "../../src/lib/auth";

const NIMBUS_V2_SERVICEABILITY_URL = "https://api-v2.nimbuspost.com/v2/serviceability";
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
    const candidatePayloads = [
      // Variation 1: orderValue as string "289"
      {
        name: "orderValue as string",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          orderValue: "289",
          packages: [{ weight: 0.21, length: 12, width: 5, height: 25 }],
        },
      },
      // Variation 2: orderValue inside package object
      {
        name: "orderValue inside package",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          packages: [{ weight: 0.21, length: 12, width: 5, height: 25, orderValue: 289, value: 289, price: 289 }],
        },
      },
      // Variation 3: "order_value" string
      {
        name: "order_value string",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          order_value: "289",
          packages: [{ weight: 0.21, length: 12, width: 5, height: 25 }],
        },
      },
      // Variation 4: "orderAmount" string
      {
        name: "orderAmount string",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          orderAmount: "289",
          packages: [{ weight: 0.21, length: 12, width: 5, height: 25 }],
        },
      },
      // Variation 5: order object
      {
        name: "nested order object",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          order: { value: 289, amount: 289 },
          packages: [{ weight: 0.21, length: 12, width: 5, height: 25 }],
        },
      },
      // Variation 6: collectableAmount / invoiceAmount
      {
        name: "collectableAmount / invoiceAmount",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          collectableAmount: 289,
          invoiceAmount: 289,
          packages: [{ weight: 0.21, length: 12, width: 5, height: 25 }],
        },
      },
    ];

    const attempts: any[] = [];
    let successfulResponse: any = null;
    let successfulSchemaName = "";
    let matchedPayload: any = null;

    for (const c of candidatePayloads) {
      const res = await fetch(NIMBUS_V2_SERVICEABILITY_URL, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(c.payload),
      });

      const body = (await res.json().catch(() => ({}))) as any;
      const isSuccess = res.ok && (body.success === true || body.status === true || Array.isArray(body.data) || Array.isArray(body));

      attempts.push({
        schema: c.name,
        httpStatus: res.status,
        success: isSuccess,
        response: body,
      });

      if (isSuccess) {
        successfulResponse = body;
        successfulSchemaName = c.name;
        matchedPayload = c.payload;
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
          endpoint: NIMBUS_V2_SERVICEABILITY_URL,
          httpStatus: 200,
          isServiceable: rawList.length > 0,
          matchedSchema: successfulSchemaName,
          matchedPayload,
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
        endpoint: NIMBUS_V2_SERVICEABILITY_URL,
        message: "NimbusPost v2 serviceability validation response received.",
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
