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
  const apiKey = (
    (typeof netlifyEnv?.get === "function" && netlifyEnv.get("NIMBUSPOST_API_KEY")) ||
    process.env["NIMBUSPOST_API_KEY"] ||
    ""
  ).trim();
  const apiSecret = (
    (typeof netlifyEnv?.get === "function" && netlifyEnv.get("NIMBUSPOST_API_SECRET")) ||
    process.env["NIMBUSPOST_API_SECRET"] ||
    ""
  ).trim();

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

  try {
    let token = "";
    let authMethodUsed = "";

    // Method 1: Direct Header Auth if apiKey is already an API token / Bearer token
    if (!apiKey.includes("@")) {
      // Test direct Bearer Token
      const directBearerRes = await fetch(`${NIMBUS_BASE_URL}/courier/serviceability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(serviceabilityPayload),
      });
      const directBearerData = (await directBearerRes.json().catch(() => ({}))) as any;

      if (directBearerRes.ok && directBearerData.status) {
        token = apiKey;
        authMethodUsed = "Direct Bearer Token";
        return formatSuccessResponse(directBearerData, authMethodUsed, serviceabilityPayload);
      }

      // Test Direct API Key + Secret Headers
      const directKeyRes = await fetch(`${NIMBUS_BASE_URL}/courier/serviceability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "api-key": apiKey,
          "api-secret": apiSecret,
        },
        body: JSON.stringify(serviceabilityPayload),
      });
      const directKeyData = (await directKeyRes.json().catch(() => ({}))) as any;

      if (directKeyRes.ok && directKeyData.status) {
        authMethodUsed = "Direct api-key / api-secret Headers";
        return formatSuccessResponse(directKeyData, authMethodUsed, serviceabilityPayload);
      }
    }

    // Method 2: Attempt Login Endpoint with Candidate Account Emails
    const candidateEmails = [
      apiKey.includes("@") ? apiKey : null,
      "durgafunmail@gmail.com",
      "owner@saatvikannafoods.in",
    ].filter(Boolean) as string[];

    let lastLoginError = "";

    for (const email of candidateEmails) {
      const loginRes = await fetch(`${NIMBUS_BASE_URL}/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password: apiSecret }),
      });

      const loginData = (await loginRes.json().catch(() => ({}))) as any;

      if (loginRes.ok && loginData.status && loginData.data) {
        token = String(loginData.data).trim();
        authMethodUsed = `POST /users/login (JWT Token exchanged for registered email)`;
        break;
      } else {
        lastLoginError = loginData.message || JSON.stringify(loginData.errors || "Login failed");
      }
    }

    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          stage: "AUTHENTICATION",
          apiKeyFormat: apiKey.includes("@") ? "email" : "alphanumeric_key",
          message: `NimbusPost authentication unsuccessful. Response: ${lastLoginError}`,
          hint: "If using API Key / Secret, ensure NIMBUSPOST_API_KEY contains the account login email (or a valid API Token).",
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Call serviceability with acquired JWT
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

    return formatSuccessResponse(courierData, authMethodUsed, serviceabilityPayload);
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

function formatSuccessResponse(courierData: any, authMethod: string, payload: any) {
  const rawList = Array.isArray(courierData.data) ? courierData.data : [];
  const sanitizedCouriers = rawList.map((c: any) => ({
    courierId: c.id || c.courier_id || "N/A",
    courierName: c.name || c.courier_name || "Unknown Courier",
    totalRate: Number(c.total_charges || c.freight_charges || c.rate || 0),
    freightCharges: c.freight_charges !== undefined ? Number(c.freight_charges) : undefined,
    fuelSurcharge: c.fuel_surcharge !== undefined ? Number(c.fuel_surcharge) : undefined,
    codCharges: c.cod_charges !== undefined ? Number(c.cod_charges) : undefined,
    taxAmount: c.tax_amount || c.gst !== undefined ? Number(c.tax_amount || c.gst) : undefined,
    chargeableWeight: c.chargeable_weight || c.charged_weight || `${payload.weight}g`,
    estimatedDeliveryDays: c.estimated_delivery_days || c.edd || "N/A",
    estimatedDeliveryDate: c.delivery_date || c.expected_delivery_date || "N/A",
    isServiceable: true,
  }));

  return new Response(
    JSON.stringify({
      success: true,
      authentication: {
        status: true,
        method: authMethod,
        message: "NimbusPost authentication verified",
      },
      serviceability: {
        status: true,
        pickupPincode: payload.origin,
        destinationPincode: payload.destination,
        paymentType: payload.payment_type,
        orderAmount: payload.order_amount,
        parcelSpecs: {
          weightGrams: payload.weight,
          lengthCm: payload.length,
          breadthCm: payload.breadth,
          heightCm: payload.height,
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
}

export const config = {
  path: "/.netlify/functions/admin-shipping-probe",
};
