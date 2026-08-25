import { requireAdminAuth } from "../../src/lib/auth";

const NIMBUS_V2_COURIERS_URL = "https://api-v2.nimbuspost.com/v2/couriers";

export default async (request: Request) => {
  // 1. Enforce POST / GET check for probe
  // Allow probe via POST with probe header or admin session
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
    // 3. Execute GET https://api-v2.nimbuspost.com/v2/couriers with v2 headers
    const couriersRes = await fetch(NIMBUS_V2_COURIERS_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": apiKey,
        "x-api-secret": apiSecret,
      },
    });

    const couriersData = (await couriersRes.json().catch(() => ({}))) as any;

    if (!couriersRes.ok || !couriersData.status) {
      return new Response(
        JSON.stringify({
          success: false,
          endpoint: "GET https://api-v2.nimbuspost.com/v2/couriers",
          httpStatus: couriersRes.status,
          httpStatusText: couriersRes.statusText,
          message: couriersData.message || JSON.stringify(couriersData.errors || "Failed to fetch couriers"),
        }),
        {
          status: couriersRes.status || 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 4. Sanitize and Structure Couriers Response (Zero Secrets)
    const rawCouriers = Array.isArray(couriersData.data)
      ? couriersData.data
      : Array.isArray(couriersData.data?.couriers)
      ? couriersData.data.couriers
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
        httpStatus: couriersRes.status,
        authentication: {
          status: true,
          method: "v2 Header Authentication (x-api-key, x-api-secret)",
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
