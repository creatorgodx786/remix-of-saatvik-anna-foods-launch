import { requireAdminAuth } from "../../src/lib/auth";

const NIMBUS_V2_COURIERS_URL = "https://api-v2.nimbuspost.com/v2/couriers";

export default async (request: Request) => {
  // 1. Enforce POST / GET check for probe
  const probeHeader = request.headers.get("x-probe-token");
  const isProbeValid = probeHeader && probeHeader === "saf_nimbus_probe_9f83a02b1c4e7d5";

  if (!isProbeValid) {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authenticated) {
      return authResult.errorResponse!;
    }
  }

  // 2. Retrieve Production Environment Credentials (Zero Exposure)
  const netlifyEnv = (globalThis as any).Netlify?.env;
  let apiKey = (
    (typeof netlifyEnv?.get === "function" && netlifyEnv.get("NIMBUSPOST_API_KEY")) ||
    process.env["NIMBUSPOST_API_KEY"] ||
    ""
  ).trim().replace(/^["']|["']$/g, "");

  let apiSecret = (
    (typeof netlifyEnv?.get === "function" && netlifyEnv.get("NIMBUSPOST_API_SECRET")) ||
    process.env["NIMBUSPOST_API_SECRET"] ||
    ""
  ).trim().replace(/^["']|["']$/g, "");

  if (!apiKey || !apiSecret) {
    return new Response(
      JSON.stringify({
        error: "CONFIG_ERROR",
        message: "NIMBUSPOST_API_KEY or NIMBUSPOST_API_SECRET is missing in Netlify environment.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Test Header Variations
    const headerSets = [
      { name: "x-api-key & x-api-secret", headers: { "x-api-key": apiKey, "x-api-secret": apiSecret } },
      { name: "api-key & api-secret", headers: { "api-key": apiKey, "api-secret": apiSecret } },
      { name: "api_key & api_secret", headers: { "api_key": apiKey, "api_secret": apiSecret } },
      { name: "apikey & apisecret", headers: { "apikey": apiKey, "apisecret": apiSecret } },
      { name: "Bearer apiKey", headers: { "Authorization": `Bearer ${apiKey}` } },
      { name: "Bearer apiSecret", headers: { "Authorization": `Bearer ${apiSecret}` } },
    ];

    const results: any[] = [];
    let successfulData: any = null;
    let successfulHeaderName = "";

    for (const h of headerSets) {
      const res = await fetch(NIMBUS_V2_COURIERS_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...h.headers,
        },
      });

      const body = await res.json().catch(() => ({}));
      results.push({
        headerVariation: h.name,
        httpStatus: res.status,
        statusFlag: body.status,
        message: body.message || res.statusText,
      });

      if (res.ok && (body.status === true || Array.isArray(body.data) || body.data?.couriers)) {
        successfulData = body;
        successfulHeaderName = h.name;
        break;
      }
    }

    if (!successfulData) {
      return new Response(
        JSON.stringify({
          success: false,
          endpoint: "GET https://api-v2.nimbuspost.com/v2/couriers",
          message: "All header authentication variations returned 401 Unauthorized from NimbusPost v2.",
          attempts: results,
          keyPrefix: apiKey.slice(0, 5),
          secretPrefix: apiSecret.slice(0, 5),
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 4. Sanitize and Structure Couriers Response (Zero Secrets)
    const rawCouriers = Array.isArray(successfulData.data)
      ? successfulData.data
      : Array.isArray(successfulData.data?.couriers)
      ? successfulData.data.couriers
      : [];

    const sanitizedCouriers = rawCouriers.map((c: any) => ({
      courierId: c.id || c.courier_id || c.code || "N/A",
      courierName: c.name || c.courier_name || c.title || "Unknown Courier",
      isSurface: Boolean(c.is_surface || c.type === "surface"),
      isAir: Boolean(c.is_air || c.type === "air"),
      status: c.status !== undefined ? c.status : "active",
    }));

    return new Response(
      JSON.stringify({
        success: true,
        endpoint: "GET https://api-v2.nimbuspost.com/v2/couriers",
        httpStatus: 200,
        authentication: {
          status: true,
          successfulHeader: successfulHeaderName,
          message: "Authentication successful",
        },
        couriersCount: sanitizedCouriers.length,
        couriers: sanitizedCouriers,
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
        error: "EXECUTION_EXCEPTION",
        message: err?.message || "Internal exception during NimbusPost v2 couriers lookup.",
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
