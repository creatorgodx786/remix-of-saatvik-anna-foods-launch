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
      // Schema 1: package with price & value
      {
        name: "package with price, value & orderValue",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          paymentMode: "prepaid",
          orderValue: 289,
          orderAmount: 289,
          packages: [
            {
              weight: 0.21,
              length: 12,
              width: 5,
              height: 25,
              price: 289,
              value: 289,
              orderValue: 289,
              amount: 289,
              qty: 1,
            },
          ],
        },
      },
      // Schema 2: GET /v2/couriers list to see what other endpoints exist
      {
        name: "GET /v2/couriers fallback probe",
        isGet: true,
        url: "https://api-v2.nimbuspost.com/v2/couriers",
      },
    ];

    const attempts: any[] = [];
    let successfulResponse: any = null;
    let successfulSchemaName = "";
    let matchedPayload: any = null;

    for (const c of candidatePayloads) {
      const res = await fetch(c.url || NIMBUS_V2_SERVICEABILITY_URL, {
        method: c.isGet ? "GET" : "POST",
        headers: commonHeaders,
        body: c.isGet ? undefined : JSON.stringify(c.payload),
      });

      const body = (await res.json().catch(() => ({}))) as any;
      const isSuccess = res.ok && (body.success === true || body.status === true || Array.isArray(body.data) || Array.isArray(body));

      attempts.push({
        schema: c.name,
        httpStatus: res.status,
        success: isSuccess,
        response: body,
      });

      if (isSuccess && !c.isGet) {
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
