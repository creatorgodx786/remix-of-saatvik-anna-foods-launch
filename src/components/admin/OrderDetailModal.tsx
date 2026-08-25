import React, { useState } from "react";
import {
  X,
  Package,
  User,
  MapPin,
  CreditCard,
  Truck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  FileText,
  Printer,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { getEffectiveParcelSpecs } from "../../data/packaging";

export interface Order {
  id: string;
  orderNumber: string;
  cashfreeOrderId: string;
  cashfreePaymentId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  shippingAddress: string;
  city: string;
  state: string;
  pincode: string;
  productName: string;
  packSize: string;
  quantity: number;
  subtotal: string;
  shippingAmount: string;
  discount: string;
  totalAmount: string;
  paymentStatus: string;
  orderStatus: string;
  
  // Legacy Shiprocket (kept for backward compatibility)
  shiprocketStatus: string | null;
  shiprocketAwb: string | null;

  // Provider-Neutral Shipping
  shippingProvider?: string | null;
  shippingOrderId?: string | null;
  shippingShipmentId?: string | null;
  shippingAwb?: string | null;
  shippingCourier?: string | null;
  shippingStatus?: string | null;
  shippingLabelUrl?: string | null;
  shippingManifestUrl?: string | null;
  shippingInvoiceUrl?: string | null;
  trackingUrl?: string | null;

  // Parcel specs
  parcelWeight?: string | null;
  parcelLength?: string | null;
  parcelBreadth?: string | null;
  parcelHeight?: string | null;

  paymentMethod: string | null;
  bankReference: string | null;
  paymentCompletionTime: string | null;
  paymentMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: (updatedOrder: Order) => void;
}

export function OrderDetailModal({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
}: OrderDetailModalProps) {
  const getInitialFulfillmentStatus = (o: Order | null) => {
    if (!o) return "PAID";
    if (o.orderStatus) return o.orderStatus;
    if (o.paymentStatus === "SUCCESS" || o.paymentStatus === "PAID") return "PAID";
    return "UNPAID";
  };

  const [orderStatus, setOrderStatus] = useState(getInitialFulfillmentStatus(order));
  const [saving, setSaving] = useState(false);
  const [bookingShipping, setBookingShipping] = useState(false);
  const [syncingTracking, setSyncingTracking] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showDimensionOverride, setShowDimensionOverride] = useState(false);

  // Default packaging specs
  const [customWeight, setCustomWeight] = useState(order?.parcelWeight || "");
  const [customLength, setCustomLength] = useState(order?.parcelLength || "");
  const [customBreadth, setCustomBreadth] = useState(order?.parcelBreadth || "");
  const [customHeight, setCustomHeight] = useState(order?.parcelHeight || "");

  React.useEffect(() => {
    if (order) {
      setOrderStatus(getInitialFulfillmentStatus(order));
      setCustomWeight(order.parcelWeight || "");
      setCustomLength(order.parcelLength || "");
      setCustomBreadth(order.parcelBreadth || "");
      setCustomHeight(order.parcelHeight || "");
      setShippingError(null);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const isPaid = order.paymentStatus === "SUCCESS" || order.paymentStatus === "PAID";
  const hasAwb = Boolean(order.shippingAwb || order.shiprocketAwb);
  const activeAwb = order.shippingAwb || order.shiprocketAwb || "";

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // 1. Create / Resume NimbusPost Shipment
  const handleCreateShipment = async () => {
    const w = Number(customWeight);
    const l = Number(customLength);
    const b = Number(customBreadth);
    const h = Number(customHeight);

    if (isNaN(w) || isNaN(l) || isNaN(b) || isNaN(h) || w <= 0 || l <= 0 || b <= 0 || h <= 0) {
      setShippingError("Parcel weight (grams) and package dimensions (L x W x H in cm) are required before creating a shipment.");
      return;
    }

    setBookingShipping(true);
    setShippingError(null);

    try {
      const res = await fetch(`/.netlify/functions/admin-shipping?action=create-shipment&orderId=${order.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dimensions: {
            weightGrams: w,
            lengthCm: l,
            breadthCm: b,
            heightCm: h,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.order) {
        onOrderUpdated(data.order);
      } else {
        setShippingError(data.message || data.error || "Shipment booking failed.");
      }
    } catch (err: any) {
      setShippingError(err?.message || "Network error while creating shipment.");
    } finally {
      setBookingShipping(false);
    }
  };

  // 2. Sync Live Tracking Status
  const handleSyncTracking = async () => {
    setSyncingTracking(true);
    setShippingError(null);

    try {
      const res = await fetch(`/.netlify/functions/admin-shipping?action=sync-tracking&orderId=${order.id}`, {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.order) {
        onOrderUpdated(data.order);
      } else {
        setShippingError(data.error || "Unable to sync tracking.");
      }
    } catch (err: any) {
      setShippingError(err?.message || "Failed to sync tracking.");
    } finally {
      setSyncingTracking(false);
    }
  };

  // 3. Save Manual Order Status Changes
  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/.netlify/functions/admin-orders?id=${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderStatus }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.order) {
        onOrderUpdated(data.order);
      }
    } catch (err) {
      console.error("Update order error:", err);
    } finally {
      setSaving(false);
    }
  };

  const getShippingBadge = (status: string | undefined | null) => {
    const s = (status || "PENDING_SHIPMENT").toUpperCase();
    switch (s) {
      case "DELIVERED":
        return <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">DELIVERED</span>;
      case "IN_TRANSIT":
      case "SHIPPED":
        return <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400">IN TRANSIT</span>;
      case "PICKUP_REQUESTED":
      case "AWB_ASSIGNED":
      case "MANIFEST_GENERATED":
        return <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-400">AWB READY</span>;
      case "BOOKING_IN_PROGRESS":
        return <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">BOOKING...</span>;
      case "BOOKING_FAILED":
        return <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-400">BOOKING FAILED</span>;
      default:
        return <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">PENDING SHIPMENT</span>;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            PAID / SUCCESS
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <Clock className="h-3.5 w-3.5" />
            PENDING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {status.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-primary/15 bg-card shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-foreground">{order.orderNumber}</h2>
              {getPaymentBadge(order.paymentStatus)}
              {getShippingBadge(order.shippingStatus)}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Created on {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Banner */}
          {shippingError && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{shippingError}</span>
            </div>
          )}

          {/* Customer & Shipping Summary Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Customer Details */}
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
                <User className="h-4 w-4" />
                Customer Contact
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-semibold text-foreground">{order.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-foreground">{order.customerPhone}</span>
                    <button
                      onClick={() => copyToClipboard(order.customerPhone, "phone")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copiedField === "phone" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
                {order.customerEmail && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="text-foreground">{order.customerEmail}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Address */}
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
                <MapPin className="h-4 w-4" />
                Delivery Address
              </div>
              <p className="mt-3 text-xs leading-relaxed text-foreground whitespace-pre-line">
                {order.shippingAddress}
                {"\n"}
                {order.city}, {order.state} - <span className="font-mono font-bold">{order.pincode}</span>
              </p>
            </div>
          </div>

          {/* Product & Order Items Breakdown */}
          <div className="rounded-xl border border-border/80 bg-background/60 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
              <Package className="h-4 w-4" />
              Purchased Items
            </div>
            <div className="mt-3 divide-y divide-border/60 text-xs">
              <div className="flex items-center justify-between pb-3">
                <div>
                  <p className="font-semibold text-foreground">{order.productName}</p>
                  <p className="text-muted-foreground">Pack: {order.packSize} × {order.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">₹{Number(order.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium">Free Delivery</p>
                </div>
              </div>
            </div>
          </div>

          {/* NIMBUSPOST LOGISTICS & FULFILLMENT SECTION */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-primary uppercase">
                <Truck className="h-4 w-4" />
                NimbusPost Logistics & Courier Booking
              </div>
              {hasAwb && (
                <button
                  onClick={handleSyncTracking}
                  disabled={syncingTracking}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${syncingTracking ? "animate-spin" : ""}`} />
                  Sync Live Tracking
                </button>
              )}
            </div>

            {/* AWB & Fulfillment Details Card */}
            {hasAwb ? (
              <div className="mt-4 rounded-xl border border-border bg-card p-4 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground">Assigned Courier:</span>
                    <p className="font-bold text-foreground text-sm">{order.shippingCourier || "NimbusPost Partner"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">AWB Tracking Number:</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-primary text-sm">{activeAwb}</span>
                      <button
                        onClick={() => copyToClipboard(activeAwb, "awb")}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {copiedField === "awb" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Document Downloads & Tracking Buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {order.shippingLabelUrl ? (
                    <a
                      href={order.shippingLabelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print Shipping Label
                    </a>
                  ) : (
                    <a
                      href={`/.netlify/functions/admin-shipping?action=label&orderId=${order.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-muted"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Fetch Label
                    </a>
                  )}

                  <a
                    href={`/.netlify/functions/admin-shipping?action=manifest&orderId=${order.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Download Manifest
                  </a>

                  <a
                    href={`/.netlify/functions/admin-shipping?action=invoice&orderId=${order.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Download Invoice
                  </a>

                  <a
                    href={order.trackingUrl || `https://nimbuspost.com/track/${activeAwb}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Live Tracking Portal
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-xs">
                {/* Packaging Specs & Dimension Inputs */}
                <div className="rounded-xl border border-border bg-card p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">Actual Parcel Specifications</p>
                      <p className="text-muted-foreground text-[11px]">
                        Enter exact packed weight and box dimensions required for courier booking.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border">
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground">Weight (grams) *</label>
                      <input
                        type="number"
                        placeholder="e.g. 250"
                        value={customWeight}
                        onChange={(e) => setCustomWeight(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground">Length (cm) *</label>
                      <input
                        type="number"
                        placeholder="e.g. 20"
                        value={customLength}
                        onChange={(e) => setCustomLength(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground">Breadth (cm) *</label>
                      <input
                        type="number"
                        placeholder="e.g. 15"
                        value={customBreadth}
                        onChange={(e) => setCustomBreadth(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground">Height (cm) *</label>
                      <input
                        type="number"
                        placeholder="e.g. 10"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Create Shipment Button */}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-muted-foreground">
                    {isPaid
                      ? "Order is paid. Ready to generate AWB and book with NimbusPost."
                      : "Shipment booking is disabled until payment status is SUCCESS / PAID."}
                  </p>

                  <button
                    onClick={handleCreateShipment}
                    disabled={!isPaid || bookingShipping}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {bookingShipping ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Booking NimbusPost...
                      </>
                    ) : (
                      <>
                        <Truck className="h-3.5 w-3.5" />
                        Book NimbusPost Shipment
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cashfree Gateway & Manual Controls */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Cashfree Payment Gateway Details */}
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
                <CreditCard className="h-4 w-4" />
                Cashfree Gateway Details
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Cashfree Order ID:</span>
                  <p className="font-mono font-medium text-foreground break-all">{order.cashfreeOrderId}</p>
                </div>
                {order.cashfreePaymentId && (
                  <div>
                    <span className="text-muted-foreground">Transaction ID:</span>
                    <p className="font-mono font-medium text-foreground break-all">{order.cashfreePaymentId}</p>
                  </div>
                )}
                {order.paymentMethod && (
                  <div>
                    <span className="text-muted-foreground">Payment Method:</span>
                    <span className="ml-2 font-semibold text-foreground">{order.paymentMethod}</span>
                  </div>
                )}
                {order.bankReference && (
                  <div>
                    <span className="text-muted-foreground">Bank Reference:</span>
                    <span className="ml-2 font-mono text-foreground">{order.bankReference}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Gateway Status:</span>
                  <span className="ml-2 font-semibold text-foreground">{order.paymentStatus}</span>
                </div>
              </div>
            </div>

            {/* Manual Status Override */}
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
                <Sliders className="h-4 w-4" />
                Manual Status Override
              </div>
              <div className="mt-3 space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-muted-foreground">Order Status</label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="PAID">PAID</option>
                    <option value="PROCESSING">PROCESSING</option>
                    <option value="SHIPPED">SHIPPED</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="UNPAID">UNPAID</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-input bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            Close
          </button>
          <button
            onClick={handleSaveChanges}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Order Updates"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
