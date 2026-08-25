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

  // Sanitize for request
  const apiKey = rawApiKey.trim().replace(/^["']|["']$/g, "");
  const apiSecret = rawApiSecret.trim().replace(/^["']|["']$/g, "");

  // Non-sensitive telemetry to verify Netlify environment propagation
  const envTelemetry = {
    deployTimestamp: DEPLOY_TIMESTAMP,
    isKeyConfigured: Boolean(apiKey),
    isSecretConfigured: Boolean(apiSecret),
    keyTelemetry: {
      length: rawApiKey.length,
      trimmedLength: apiKey.length,
      prefix: apiKey ? `${apiKey.slice(0, 6)}...` : "N/A",
      suffix: apiKey ? `...${apiKey.slice(-4)}` : "N/A",
      hadLeadingTrailingWhitespace: rawApiKey.length !== rawApiKey.trim().length,
      hadSurroundingQuotes: rawApiKey.startsWith('"') || rawApiKey.startsWith("'"),
    },
    secretTelemetry: {
      length: rawApiSecret.length,
      trimmedLength: apiSecret.length,
      prefix: apiSecret ? `${apiSecret.slice(0, 4)}...` : "N/A",
      suffix: apiSecret ? `...${apiSecret.slice(-4)}` : "N/A",
      hadLeadingTrailingWhitespace: rawApiSecret.length !== rawApiSecret.trim().length,
      hadSurroundingQuotes: rawApiSecret.startsWith('"') || rawApiSecret.startsWith("'"),
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
    // 3. Execute GET https://api-v2.nimbuspost.com/v2/couriers
    const res = await fetch(NIMBUS_V2_COURIERS_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": apiKey,
        "x-api-secret": apiSecret,
      },
    });

    const body = (await res.json().catch(() => ({}))) as any;

    if (!res.ok || !body.status) {
      return new Response(
        JSON.stringify({
          success: false,
          endpoint: NIMBUS_V2_COURIERS_URL,
          httpStatus: res.status,
          httpStatusText: res.statusText,
          apiResponse: {
            status: body.status,
            message: body.message,
            error: body.error,
            meta: body.meta,
          },
          envTelemetry,
        }),
        {
          status: res.status || 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const rawCouriers = Array.isArray(body.data)
      ? body.data
      : Array.isArray(body.data?.couriers)
      ? body.data.couriers
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
        httpStatus: res.status,
        authentication: {
          status: true,
          method: "x-api-key, x-api-secret headers",
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
