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
    // 3. Test exact payload structures against POST https://api-v2.nimbuspost.com/v2/serviceability
    const candidatePayloads = [
      // Schema A: Numeric integer pincodes & grams
      {
        name: "Numeric Pincodes & Grams",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          weight: 205,
          length: 12,
          breadth: 5,
          height: 25,
          orderAmount: 289,
          paymentType: "prepaid",
          isCod: false,
        },
      },
      // Schema B: Numeric integer pincodes & kg
      {
        name: "Numeric Pincodes & Kg",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          weight: 0.205,
          length: 12,
          breadth: 5,
          height: 25,
          orderAmount: 289,
          paymentType: "prepaid",
          isCod: false,
        },
      },
      // Schema C: String pincodes & package dimensions prefixed
      {
        name: "Package prefixed fields",
        payload: {
          pickupPincode: 221311,
          deliveryPincode: 221011,
          packageWeight: 205,
          packageLength: 12,
          packageBreadth: 5,
          packageHeight: 25,
          orderAmount: 289,
          paymentType: "prepaid",
        },
      },
      // Schema D: String pincodes
      {
        name: "String Pincodes",
        payload: {
          pickupPincode: "221311",
          deliveryPincode: "221011",
          weight: 205,
          length: 12,
          breadth: 5,
          height: 25,
          orderAmount: 289,
          paymentType: "prepaid",
        },
      },
      // Schema E: origin / destination pincodes
      {
        name: "originPincode / destinationPincode",
        payload: {
          originPincode: 221311,
          destinationPincode: 221011,
          weight: 205,
          length: 12,
          breadth: 5,
          height: 25,
          orderAmount: 289,
          paymentType: "prepaid",
        },
      },
    ];

    const attempts: any[] = [];
    let successfulResponse: any = null;
    let successfulSchemaName = "";

    for (const c of candidatePayloads) {
      const res = await fetch(NIMBUS_V2_SERVICEABILITY_URL, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(c.payload),
      });

      const body = (await res.json().catch(() => ({}))) as any;
      const isSuccess = res.ok && (body.status === true || body.success === true || Array.isArray(body.data) || Array.isArray(body.data?.couriers) || Array.isArray(body.data?.rates));

      attempts.push({
        schema: c.name,
        httpStatus: res.status,
        success: isSuccess,
        response: body,
      });

      if (isSuccess) {
        successfulResponse = body;
        successfulSchemaName = c.name;
        break;
      }
    }

    if (successfulResponse) {
      const rawList = Array.isArray(successfulResponse.data)
        ? successfulResponse.data
        : Array.isArray(successfulResponse.data?.couriers)
        ? successfulResponse.data.couriers
        : Array.isArray(successfulResponse.data?.rates)
        ? successfulResponse.data.rates
        : [];

      const sanitizedCouriers = rawList.map((c: any) => ({
        courierId: c.id || c.courier_id || c.courierId || c.code || "N/A",
        courierName: c.name || c.courier_name || c.courierName || c.title || "Courier Partner",
        totalCharges: Number(c.total_charges ?? c.totalCharges ?? c.freight_charges ?? c.freightCharges ?? c.rate ?? 0),
        freightCharges: c.freight_charges !== undefined || c.freightCharges !== undefined ? Number(c.freight_charges ?? c.freightCharges) : undefined,
        fuelSurcharge: c.fuel_surcharge !== undefined || c.fuelSurcharge !== undefined ? Number(c.fuel_surcharge ?? c.fuelSurcharge) : undefined,
        codCharges: c.cod_charges !== undefined || c.codCharges !== undefined ? Number(c.cod_charges ?? c.codCharges) : undefined,
        taxAmount: c.tax_amount || c.gst || c.taxAmount !== undefined ? Number(c.tax_amount ?? c.gst ?? c.taxAmount) : undefined,
        chargeableWeight: c.chargeable_weight || c.charged_weight || c.chargeableWeight || "205g",
        estimatedDeliveryDays: c.estimated_delivery_days || c.edd || c.estimatedDeliveryDays || "N/A",
        estimatedDeliveryDate: c.delivery_date || c.expected_delivery_date || c.expectedDeliveryDate || "N/A",
        isServiceable: true,
      }));

      return new Response(
        JSON.stringify({
          success: true,
          endpoint: NIMBUS_V2_SERVICEABILITY_URL,
          httpStatus: 200,
          isServiceable: sanitizedCouriers.length > 0,
          matchedSchema: successfulSchemaName,
          testParcel: {
            pickupPincode: "221311",
            destinationPincode: "221011",
            weightGrams: 205,
            dimensionsCm: "12 x 5 x 25",
            paymentType: "prepaid",
            orderAmount: 289,
          },
          availableCouriersCount: sanitizedCouriers.length,
          couriers: sanitizedCouriers,
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
