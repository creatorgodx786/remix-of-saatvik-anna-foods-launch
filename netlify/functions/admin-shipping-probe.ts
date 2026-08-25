import { requireAdminAuth } from "../../src/lib/auth";

const NIMBUS_V2_COURIERS_URL = "https://api-v2.nimbuspost.com/v2/couriers";
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

  // 2. Retrieve Environment Variables in Netlify Runtime
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

  const envTelemetry = {
    deployTimestamp: DEPLOY_TIMESTAMP,
    isKeyConfigured: Boolean(apiKey),
    isSecretConfigured: Boolean(apiSecret),
    keyTelemetry: {
      length: rawApiKey.length,
      trimmedLength: apiKey.length,
      prefix: apiKey ? `${apiKey.slice(0, 6)}...` : "N/A",
      suffix: apiKey ? `...${apiKey.slice(-4)}` : "N/A",
    },
    secretTelemetry: {
      length: rawApiSecret.length,
      trimmedLength: apiSecret.length,
      prefix: apiSecret ? `${apiSecret.slice(0, 4)}...` : "N/A",
      suffix: apiSecret ? `...${apiSecret.slice(-4)}` : "N/A",
    },
  };

  if (!apiKey || !apiSecret) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "CONFIG_ERROR",
        message: "NIMBUSPOST_API_KEY or NIMBUSPOST_API_SECRET is missing in Netlify environment.",
        envTelemetry,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // 3. Exhaustive Header Combinations Test against GET /v2/couriers
    const basicAuth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    const combinations = [
      { name: "x-api-key + x-api-secret", headers: { "x-api-key": apiKey, "x-api-secret": apiSecret } },
      { name: "x-api-key + x-secret-key", headers: { "x-api-key": apiKey, "x-secret-key": apiSecret } },
      { name: "api-key + api-secret", headers: { "api-key": apiKey, "api-secret": apiSecret } },
      { name: "api-key + secret-key", headers: { "api-key": apiKey, "secret-key": apiSecret } },
      { name: "apikey + apisecret", headers: { "apikey": apiKey, "apisecret": apiSecret } },
      { name: "x-api-key solo", headers: { "x-api-key": apiKey } },
      { name: "api-key solo", headers: { "api-key": apiKey } },
      { name: "Authorization: Bearer apiKey", headers: { "Authorization": `Bearer ${apiKey}` } },
      { name: "Authorization: Basic (apiKey:apiSecret)", headers: { "Authorization": `Basic ${basicAuth}` } },
      { name: "key + secret", headers: { "key": apiKey, "secret": apiSecret } },
    ];

    const attempts: any[] = [];
    let successfulData: any = null;
    let successfulHeaderName = "";

    for (const combo of combinations) {
      const res = await fetch(NIMBUS_V2_COURIERS_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...combo.headers,
        },
      });

      const body = await res.json().catch(() => ({}));
      const isSuccess = res.ok && (body.status === true || Array.isArray(body.data) || body.data?.couriers || body.success === true);

      attempts.push({
        headerPattern: combo.name,
        httpStatus: res.status,
        statusFlag: body.status !== undefined ? body.status : body.success,
        message: body.message || body.error?.detail || body.error?.message || res.statusText,
        error: body.error,
      });

      if (isSuccess) {
        successfulData = body;
        successfulHeaderName = combo.name;
        break;
      }
    }

    if (!successfulData) {
      return new Response(
        JSON.stringify({
          success: false,
          endpoint: NIMBUS_V2_COURIERS_URL,
          message: "All authentication header patterns returned error from NimbusPost v2.",
          envTelemetry,
          attempts,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 4. Sanitize and Structure Couriers Response
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
        endpoint: NIMBUS_V2_COURIERS_URL,
        httpStatus: 200,
        authentication: {
          status: true,
          authenticatedWithHeader: successfulHeaderName,
          message: "NimbusPost v2 authentication verified successfully",
        },
        envTelemetry,
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
        message: err?.message || "Internal exception during NimbusPost probe.",
        envTelemetry,
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
