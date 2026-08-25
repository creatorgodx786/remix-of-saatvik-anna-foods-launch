import crypto from "node:crypto";
import { getEffectiveParcelSpecs, ParcelDimensionsInput } from "../data/packaging";
import { CONTACT, BRAND } from "../data/site";

const NIMBUS_V2_BASE_URL = "https://api-v2.nimbuspost.com/v2";

export interface NimbusShipmentResponse {
  status: boolean;
  message?: string;
  data?: {
    order_id?: number | string;
    shipment_id?: number | string;
    status?: string;
    [key: string]: any;
  };
  errors?: any;
}

export interface NimbusAwbResponse {
  status: boolean;
  message?: string;
  data?: {
    shipment_id?: number | string;
    awb_number?: string;
    courier_id?: number | string;
    courier_name?: string;
    status?: string;
    label?: string;
    [key: string]: any;
  };
}

export interface NimbusLabelResponse {
  status: boolean;
  message?: string;
  data?: {
    label_url?: string;
    [key: string]: any;
  };
}

export interface NimbusManifestResponse {
  status: boolean;
  message?: string;
  data?: {
    manifest_url?: string;
    [key: string]: any;
  };
}

export interface NimbusInvoiceResponse {
  status: boolean;
  message?: string;
  data?: {
    invoice_url?: string;
    [key: string]: any;
  };
}

export interface NimbusTrackingResponse {
  status: boolean;
  message?: string;
  data?: {
    awb?: string;
    courier_name?: string;
    current_status?: string;
    history?: Array<{
      time?: string;
      location?: string;
      activity?: string;
      status_code?: string;
    }>;
  };
}

/**
 * Retrieves sanitized credentials from the environment.
 */
function getNimbusV2Credentials(): { apiKey: string; apiSecret: string } {
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
    throw new Error("NIMBUSPOST_API_KEY or NIMBUSPOST_API_SECRET is missing in environment.");
  }

  return { apiKey, apiSecret };
}

/**
 * Helper to make authenticated requests to NimbusPost v2 API with x-api-key / x-api-secret headers.
 */
async function nimbusV2Fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { apiKey, apiSecret } = getNimbusV2Credentials();

  const url = path.startsWith("http") ? path : `${NIMBUS_V2_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": apiKey,
      "x-api-secret": apiSecret,
      ...(options.headers || {}),
    },
  });

  const data = (await res.json().catch(() => ({}))) as T;
  return data;
}

/**
 * Retrieves the list of available couriers (v2).
 */
export async function getNimbusCouriers(): Promise<{ status: boolean; data?: any; message?: string }> {
  return nimbusV2Fetch("/couriers", { method: "GET" });
}

/**
 * Checks courier serviceability and rate for a shipment (v2).
 */
export async function checkNimbusServiceability(payload: {
  origin: string;
  destination: string;
  payment_type: string;
  order_amount: number;
  weight: number;
  length: number;
  breadth: number;
  height: number;
}): Promise<{ status: boolean; data?: any; message?: string }> {
  return nimbusV2Fetch("/courier/serviceability", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Creates a new order/shipment in NimbusPost v2.
 */
export async function createNimbusShipment(
  order: {
    orderNumber: string;
    totalAmount: string;
    subtotal: string;
    shippingAmount: string;
    discount: string;
    productName: string;
    packSize: string;
    quantity: number;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    shippingAddress: string;
    city: string;
    state: string;
    pincode: string;
  },
  dimensionsOverride?: ParcelDimensionsInput
): Promise<NimbusShipmentResponse> {
  const specs = getEffectiveParcelSpecs(order.packSize, order.quantity, dimensionsOverride);

  if (!specs.isValid) {
    throw new Error("Invalid parcel specifications. Weight and box dimensions must be greater than zero.");
  }

  const payload = {
    order_number: order.orderNumber,
    shipping_charges: Number(order.shippingAmount || 0),
    discount: Number(order.discount || 0),
    cod_charges: 0,
    payment_type: "prepaid",
    order_amount: Number(order.totalAmount),
    package_weight: specs.weightGrams,
    package_length: specs.lengthCm,
    package_breadth: specs.breadthCm,
    package_height: specs.heightCm,
    request_auto_pickup: "no",
    consignee: {
      name: order.customerName.trim(),
      address: order.shippingAddress.trim(),
      address_2: "",
      city: order.city.trim(),
      state: order.state.trim(),
      pincode: order.pincode.trim(),
      phone: order.customerPhone.trim(),
      email: order.customerEmail ? order.customerEmail.trim() : "care@saatvikannafoods.in",
    },
    pickup: {
      warehouse_name: BRAND.name,
      name: "Suraj Singh",
      address: CONTACT.addressLines.join(" "),
      city: "Varanasi",
      state: "Uttar Pradesh",
      pincode: "221311",
      phone: CONTACT.phone,
    },
    order_items: [
      {
        name: `${order.productName} (${order.packSize})`,
        qty: Math.max(1, order.quantity || 1),
        price: Number(order.subtotal),
        sku: specs.sku,
      },
    ],
  };

  return nimbusV2Fetch<NimbusShipmentResponse>("/shipments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Assigns courier and generates AWB for an existing shipment (v2).
 */
export async function assignNimbusAwb(
  shipmentId: string | number,
  courierId: string | number = "auto"
): Promise<NimbusAwbResponse> {
  return nimbusV2Fetch<NimbusAwbResponse>("/shipments/awb", {
    method: "POST",
    body: JSON.stringify({
      shipment_id: shipmentId,
      courier_id: courierId,
    }),
  });
}

/**
 * Retrieves the official printable shipping label PDF URL for an AWB (v2).
 */
export async function getNimbusLabel(awb: string): Promise<NimbusLabelResponse> {
  return nimbusV2Fetch<NimbusLabelResponse>("/shipments/label", {
    method: "POST",
    body: JSON.stringify({ awb: [awb] }),
  });
}

/**
 * Retrieves the courier handover manifest PDF URL for an AWB (v2).
 */
export async function getNimbusManifest(awb: string): Promise<NimbusManifestResponse> {
  return nimbusV2Fetch<NimbusManifestResponse>("/shipments/manifest", {
    method: "POST",
    body: JSON.stringify({ awb: [awb] }),
  });
}

/**
 * Retrieves the tax invoice PDF URL for an AWB or shipment (v2).
 */
export async function getNimbusInvoice(awb: string): Promise<NimbusInvoiceResponse> {
  return nimbusV2Fetch<NimbusInvoiceResponse>("/shipments/invoice", {
    method: "POST",
    body: JSON.stringify({ awb: [awb] }),
  });
}

/**
 * Requests pickup for a booked shipment (v2).
 */
export async function requestNimbusPickup(shipmentId: string | number): Promise<{ status: boolean; message?: string }> {
  return nimbusV2Fetch<{ status: boolean; message?: string }>("/shipments/pickup", {
    method: "POST",
    body: JSON.stringify({ shipment_id: shipmentId }),
  });
}

/**
 * Tracks a shipment in real-time by AWB (v2).
 */
export async function trackNimbusShipment(awb: string): Promise<NimbusTrackingResponse> {
  return nimbusV2Fetch<NimbusTrackingResponse>("/shipments/track", {
    method: "POST",
    body: JSON.stringify({ awb }),
  });
}

/**
 * Validates NimbusPost webhook authentication header or HMAC signature.
 */
export function verifyNimbusWebhook(
  authHeader: string | null,
  rawBody: string,
  secretKey?: string
): boolean {
  const netlifyEnv = (globalThis as any).Netlify?.env;
  const secret =
    secretKey ||
    (typeof netlifyEnv?.get === "function" && netlifyEnv.get("NIMBUSPOST_API_SECRET")) ||
    process.env["NIMBUSPOST_API_SECRET"] ||
    "";

  if (!authHeader) {
    return false;
  }

  // Check Bearer / direct token match
  if (authHeader.startsWith("Bearer ") || authHeader.startsWith("Token ")) {
    const token = authHeader.split(" ")[1];
    return token === secret;
  }

  // Check HMAC SHA-256 signature if provided in header
  if (secret && rawBody) {
    const computedHmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const bufA = Buffer.from(computedHmac);
    const bufB = Buffer.from(authHeader);
    if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
      return true;
    }
  }

  return authHeader === secret;
}
