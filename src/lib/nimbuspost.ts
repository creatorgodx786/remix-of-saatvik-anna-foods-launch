import crypto from "node:crypto";
import { getEffectiveParcelSpecs, ParcelDimensionsInput } from "../data/packaging";
import { CONTACT, BRAND } from "../data/site";

const NIMBUS_V2_BASE_URL = "https://api-v2.nimbuspost.com/v2";

export interface NimbusShipmentResponse {
  status?: boolean;
  success?: boolean;
  message?: string;
  data?: {
    order_id?: number | string;
    shipment_id?: number | string;
    status?: string;
    [key: string]: any;
  };
  error?: {
    type?: string;
    title?: string;
    status?: number;
    code?: string;
    detail?: string;
    message?: string;
    [key: string]: any;
  };
  errors?: any;
}

export interface NimbusAwbResponse {
  status?: boolean;
  success?: boolean;
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
  error?: {
    code?: string;
    detail?: string;
    message?: string;
    [key: string]: any;
  };
  errors?: any;
}

export interface NimbusLabelResponse {
  status?: boolean;
  success?: boolean;
  message?: string;
  data?: {
    label_url?: string;
    [key: string]: any;
  };
  error?: any;
}

export interface NimbusManifestResponse {
  status?: boolean;
  success?: boolean;
  message?: string;
  data?: {
    manifest_url?: string;
    [key: string]: any;
  };
  error?: any;
}

export interface NimbusInvoiceResponse {
  status?: boolean;
  success?: boolean;
  message?: string;
  data?: {
    invoice_url?: string;
    [key: string]: any;
  };
  error?: any;
}

export interface NimbusTrackingResponse {
  status?: boolean;
  success?: boolean;
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
  error?: any;
}

/**
 * Extracts the most useful, descriptive error message from a NimbusPost v2 response envelope.
 */
export function extractNimbusErrorMessage(res: any, defaultMsg = "NimbusPost API error"): string {
  if (!res) return defaultMsg;
  if (typeof res === "string") return res;
  if (res.error?.detail && typeof res.error.detail === "string") return res.error.detail;
  if (res.error?.message && typeof res.error.message === "string") return res.error.message;
  if (res.message && typeof res.message === "string") return res.message;
  if (res.detail && typeof res.detail === "string") return res.detail;
  if (res.error && typeof res.error === "string") return res.error;
  if (res.errors) {
    if (typeof res.errors === "string") return res.errors;
    return JSON.stringify(res.errors);
  }
  return defaultMsg;
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
 * Retrieves sanitized warehouse ID from the environment.
 */
export function getNimbusWarehouseId(): string {
  const netlifyEnv = (globalThis as any).Netlify?.env;
  const warehouseId = (
    (typeof netlifyEnv?.get === "function" && netlifyEnv.get("NIMBUSPOST_WAREHOUSE_ID")) ||
    process.env["NIMBUSPOST_WAREHOUSE_ID"] ||
    ""
  ).trim().replace(/^["']|["']$/g, "");

  if (!warehouseId) {
    throw new Error("NIMBUSPOST_WAREHOUSE_ID is missing in environment.");
  }

  return warehouseId;
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
export async function getNimbusCouriers(): Promise<{ status?: boolean; success?: boolean; data?: any; message?: string }> {
  return nimbusV2Fetch("/couriers", { method: "GET" });
}

/**
 * Checks courier serviceability and rate for a shipment (v2).
 */
export async function checkNimbusServiceability(payload: {
  origin: string;
  destination: string;
  payment_type?: string;
  paymentMode?: string;
  order_amount?: number;
  orderAmount?: number;
  weight: number;
  length: number;
  breadth: number;
  height: number;
}): Promise<{ status?: boolean; success?: boolean; data?: any; message?: string; error?: any }> {
  const weightKg = payload.weight > 10 ? Number((payload.weight / 1000).toFixed(2)) : Number(payload.weight.toFixed(2));
  const v2Payload = {
    pickupPincode: parseInt(payload.origin, 10),
    deliveryPincode: parseInt(payload.destination, 10),
    paymentMode: (payload.paymentMode || payload.payment_type || "prepaid").toLowerCase(),
    orderAmount: Number(payload.orderAmount ?? payload.order_amount ?? 0),
    packages: [
      {
        weight: weightKg,
        length: payload.length,
        width: payload.breadth,
        height: payload.height,
      },
    ],
  };

  return nimbusV2Fetch("/serviceability", {
    method: "POST",
    body: JSON.stringify(v2Payload),
  });
}

/**
 * Creates a new order/shipment in NimbusPost v2 with confirmed packages array schema.
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

  const weightKg = Number((specs.weightGrams / 1000).toFixed(2));

  const warehouseId = getNimbusWarehouseId();

  const payload: Record<string, any> = {
    order_number: order.orderNumber,
    order_type: "b2c",
    shipping_charges: Number(order.shippingAmount || 0),
    discount: Number(order.discount || 0),
    cod_charges: 0,
    payment_mode: "prepaid",
    order_amount: Number(order.totalAmount),
    packages: [
      {
        weight: weightKg,
        length: specs.lengthCm,
        width: specs.breadthCm,
        height: specs.heightCm,
      },
    ],
    shipping_address: {
      name: order.customerName.trim(),
      address: order.shippingAddress.trim(),
      address_2: "",
      city: order.city.trim(),
      state: order.state.trim(),
      pincode: order.pincode.trim(),
      phone: order.customerPhone.trim(),
      email: order.customerEmail ? order.customerEmail.trim() : "care@saatvikannafoods.in",
    },
    warehouse_id: warehouseId,
    items: [
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
export async function requestNimbusPickup(shipmentId: string | number): Promise<{ status?: boolean; success?: boolean; message?: string }> {
  return nimbusV2Fetch<{ status?: boolean; success?: boolean; message?: string }>("/shipments/pickup", {
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
