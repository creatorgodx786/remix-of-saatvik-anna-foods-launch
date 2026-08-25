import { requireAdminAuth } from "../../src/lib/auth";

const NIMBUS_BASE_URL = "https://api.nimbuspost.com/v1";

export default async (request: Request) => {
  // 1. Enforce POST only
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. POST only." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Enforce Admin Authentication or Secure Probe Token
  const probeHeader = request.headers.get("x-probe-token");
  const isProbeValid = probeHeader && probeHeader === "saf_nimbus_probe_9f83a02b1c4e7d5";

  if (!isProbeValid) {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authenticated) {
      return authResult.errorResponse!;
    }
  }

  // 3. Read Body & Parcel Dimensions
  const body = await request.json().catch(() => ({}));
  const weight = Number(body.weight || 205);
  const length = Number(body.length || 12);
  const breadth = Number(body.breadth || 5);
  const height = Number(body.height || 25);
  const orderAmount = Number(body.orderAmount || 289.0);
  const origin = String(body.origin || "221311").trim();
  const destination = String(body.destination || "221011").trim();
  const paymentType = String(body.paymentType || "prepaid").trim().toLowerCase();

  // 4. Retrieve Production Environment Credentials (Zero Exposure)
  const netlifyEnv = (globalThis as any).Netlify?.env;
  const apiKey =
    (typeof netlifyEnv?.get === "function" && netlifyEnv.get("NIMBUSPOST_API_KEY")) ||
    process.env["NIMBUSPOST_API_KEY"];
  const apiSecret =
    (typeof netlifyEnv?.get === "function" && netlifyEnv.get("NIMBUSPOST_API_SECRET")) ||
    process.env["NIMBUSPOST_API_SECRET"];

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
    // 5. Test NimbusPost Authentication (Login)
    const loginRes = await fetch(`${NIMBUS_BASE_URL}/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: apiKey.trim(), password: apiSecret.trim() }),
    });

    const loginData = (await loginRes.json().catch(() => ({}))) as any;

    if (!loginRes.ok || !loginData.status || !loginData.data) {
      return new Response(
        JSON.stringify({
          success: false,
          stage: "AUTHENTICATION",
          httpStatus: loginRes.status,
          message: loginData.message || JSON.stringify(loginData.errors || "NimbusPost auth failed"),
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const token = String(loginData.data).trim();

    // 6. Test Courier Serviceability & Rate Check (Read-Only)
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

    const courierRes = await fetch(`${NIMBUS_BASE_URL}/courier/serviceability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(serviceabilityPayload),
    });

    const courierData = (await courierRes.json().catch(() => ({}))) as any;

    if (!courierRes.ok || !courierData.status) {
      return new Response(
        JSON.stringify({
          success: false,
          stage: "SERVICEABILITY_LOOKUP",
          httpStatus: courierRes.status,
          message: courierData.message || JSON.stringify(courierData.errors || "Serviceability lookup failed"),
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 7. Extract & Sanitize Detailed Courier Rate Components (Zero sensitive tokens)
    const rawList = Array.isArray(courierData.data) ? courierData.data : [];
    const sanitizedCouriers = rawList.map((c: any) => ({
      courierId: c.id || c.courier_id || "N/A",
      courierName: c.name || c.courier_name || "Unknown Courier",
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
        authentication: {
          status: true,
          message: "NimbusPost authentication successful",
        },
        serviceability: {
          status: true,
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
