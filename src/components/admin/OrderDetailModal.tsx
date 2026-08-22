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
} from "lucide-react";

interface Order {
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
  shiprocketStatus: string | null;
  shiprocketAwb: string | null;
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
  const [shiprocketStatus, setShiprocketStatus] = useState(order?.shiprocketStatus || "PENDING_SHIPMENT");
  const [shiprocketAwb, setShiprocketAwb] = useState(order?.shiprocketAwb || "");
  const [saving, setSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  React.useEffect(() => {
    if (order) {
      setOrderStatus(getInitialFulfillmentStatus(order));
      setShiprocketStatus(order.shiprocketStatus || "PENDING_SHIPMENT");
      setShiprocketAwb(order.shiprocketAwb || "");
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/.netlify/functions/admin-orders?id=${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderStatus,
          shiprocketStatus,
          shiprocketAwb: shiprocketAwb.trim() || null,
        }),
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

  const getPaymentBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
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
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-primary/15 bg-card shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-foreground">{order.orderNumber}</h2>
              {getPaymentBadge(order.paymentStatus)}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Placed on {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Info Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Customer Details */}
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
                <User className="h-4 w-4" />
                Customer Contact
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Name: </span>
                  <span className="font-semibold text-foreground">{order.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-muted-foreground">Phone: </span>
                    <a href={`tel:${order.customerPhone}`} className="font-semibold text-primary hover:underline">
                      +91 {order.customerPhone}
                    </a>
                  </div>
                  <button
                    onClick={() => copyToClipboard(order.customerPhone, "phone")}
                    className="text-muted-foreground hover:text-foreground"
                    title="Copy phone"
                  >
                    {copiedField === "phone" ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {order.customerEmail && (
                  <div>
                    <span className="text-muted-foreground">Email: </span>
                    <a href={`mailto:${order.customerEmail}`} className="font-semibold text-foreground hover:underline">
                      {order.customerEmail}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
                <MapPin className="h-4 w-4" />
                Delivery Address
              </div>
              <div className="mt-3 text-xs leading-relaxed text-foreground">
                <p className="font-medium">{order.shippingAddress}</p>
                <p className="text-muted-foreground">
                  {order.city}, {order.state} - <span className="font-semibold text-foreground">{order.pincode}</span>
                </p>
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `${order.customerName}\n${order.customerPhone}\n${order.shippingAddress}\n${order.city}, ${order.state} ${order.pincode}`,
                        "address"
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    {copiedField === "address" ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
                    Copy Full Address
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Product & Pricing Breakdown */}
          <div className="rounded-xl border border-border/80 bg-background/60 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
              <Package className="h-4 w-4" />
              Order Items & Pricing
            </div>
            <div className="mt-3 divide-y divide-border text-xs">
              <div className="flex items-center justify-between pb-3">
                <div>
                  <p className="font-semibold text-foreground">{order.productName}</p>
                  <p className="text-muted-foreground">
                    Pack Size: <span className="font-medium text-foreground">{order.packSize}</span> | Quantity:{" "}
                    <span className="font-medium text-foreground">{order.quantity}</span>
                  </p>
                </div>
                <div className="text-right font-semibold text-foreground">
                  ₹{Number(order.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="pt-3 space-y-1.5 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-foreground">₹{Number(order.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping Charge</span>
                  <span className="text-accent font-medium">Free</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t border-border/60">
                  <span>Total Amount Paid</span>
                  <span className="text-primary">₹{Number(order.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment & Fulfillment Control */}
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

            {/* Order & Shipment Status Controls */}
            <div className="rounded-xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
                <Truck className="h-4 w-4" />
                Fulfillment Management
              </div>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">Order Status</label>
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

                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Shiprocket / AWB Tracking (Placeholder)
                  </label>
                  <input
                    type="text"
                    value={shiprocketAwb}
                    onChange={(e) => setShiprocketAwb(e.target.value)}
                    placeholder="Enter AWB or Tracking No."
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                  />
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



