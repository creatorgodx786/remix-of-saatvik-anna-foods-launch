import { requireAdminAuth } from "../../src/lib/auth";

const NIMBUS_V2_COURIERS_URL = "https://api-v2.nimbuspost.com/v2/couriers";
const NIMBUS_V2_SERVICEABILITY_URL = "https://api-v2.nimbuspost.com/v2/courier/serviceability";
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

  const commonHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-api-key": apiKey,
    "x-api-secret": apiSecret,
  };

  try {
    // 3. Execute GET /v2/couriers
    const couriersRes = await fetch(NIMBUS_V2_COURIERS_URL, {
      method: "GET",
      headers: commonHeaders,
    });

    const couriersBody = (await couriersRes.json().catch(() => ({}))) as any;

    // 4. Read Body & Parcel Dimensions for Serviceability / Rates
    const body = await request.json().catch(() => ({}));
    const weight = Number(body.weight || 205);
    const length = Number(body.length || 12);
    const breadth = Number(body.breadth || 5);
    const height = Number(body.height || 25);
    const orderAmount = Number(body.orderAmount || 289.0);
    const origin = String(body.origin || "221311").trim();
    const destination = String(body.destination || "221011").trim();
    const paymentType = String(body.paymentType || "prepaid").trim().toLowerCase();

    const serviceabilityPayload = {
      origin,
      destination,
      payment_type: paymentType,
      order_amount: orderAmount,
      weight,
      length,
      breadth,
      height,
    };

    // 5. Execute POST /v2/courier/serviceability (Read-Only)
    const serviceRes = await fetch(NIMBUS_V2_SERVICEABILITY_URL, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify(serviceabilityPayload),
    });

    const serviceBody = (await serviceRes.json().catch(() => ({}))) as any;

    const rawCouriers = Array.isArray(serviceBody.data)
      ? serviceBody.data
      : Array.isArray(serviceBody.data?.couriers)
      ? serviceBody.data.couriers
      : Array.isArray(couriersBody.data)
      ? couriersBody.data
      : [];

    const sanitizedCouriers = rawCouriers.map((c: any) => ({
      courierId: c.id || c.courier_id || c.code || "N/A",
      courierName: c.name || c.courier_name || c.title || "Unknown Courier",
      totalRate: Number(c.total_charges || c.freight_charges || c.rate || 0),
      freightCharges: c.freight_charges !== undefined ? Number(c.freight_charges) : undefined,
      fuelSurcharge: c.fuel_surcharge !== undefined ? Number(c.fuel_surcharge) : undefined,
      codCharges: c.cod_charges !== undefined ? Number(c.cod_charges) : undefined,
      taxAmount: c.tax_amount || c.gst !== undefined ? Number(c.tax_amount || c.gst) : undefined,
      chargeableWeight: c.chargeable_weight || c.charged_weight || `${weight}g`,
      estimatedDeliveryDays: c.estimated_delivery_days || c.edd || "N/A",
      estimatedDeliveryDate: c.delivery_date || c.expected_delivery_date || "N/A",
      isServiceable: true,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        endpoint: NIMBUS_V2_COURIERS_URL,
        httpStatus: 200,
        authentication: {
          status: true,
          authenticatedWithHeader: "x-api-key + x-api-secret",
          message: "NimbusPost v2 authentication verified successfully",
        },
        envTelemetry,
        serviceability: {
          status: serviceRes.ok && serviceBody.status !== false,
          pickupPincode: origin,
          destinationPincode: destination,
          paymentType,
          orderAmount,
          parcelSpecs: {
            weightGrams: weight,
            lengthCm: length,
            breadthCm: breadth,
            heightCm: height,
          },
          availableCouriersCount: sanitizedCouriers.length,
          couriers: sanitizedCouriers,
          rawServiceabilityResponse: serviceBody,
        },
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
