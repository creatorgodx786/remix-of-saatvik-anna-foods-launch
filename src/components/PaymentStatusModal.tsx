import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock, X, Loader2 } from "lucide-react";

type VerificationResult = {
  status: "SUCCESS" | "FAILED" | "PENDING";
  order_status?: string;
  payment_status?: string;
  message?: string;
  order_id?: string;
  order_amount?: number;
  order_currency?: string;
  order_tags?: {
    product?: string;
    pack_size?: string;
    quantity?: string;
  };
  error?: string;
};

export function PaymentStatusModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id") || params.get("orderId");

    if (!orderId) return;

    setOpen(true);
    setLoading(true);

    fetch("/.netlify/functions/verify-order?order_id=" + encodeURIComponent(orderId))
      .then(async (res) => {
        const data = await res.json();
        setResult(data);
      })
      .catch((err) => {
        setResult({
          status: "FAILED",
          error: "Unable to verify payment status.",
          message: err instanceof Error ? err.message : "Network error",
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const closeModal = () => {
    setOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("order_id");
      url.searchParams.delete("orderId");
      window.history.replaceState({}, "", url.pathname + url.hash);
    }
  };

  const handleTryAgain = () => {
    closeModal();
    const productEl = document.getElementById("product");
    if (productEl) {
      productEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-status-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-background p-6 shadow-2xl sm:p-8">
        {!loading && (
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close dialog"
            className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-mist hover:text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {loading && (
          <div className="flex flex-col items-center py-10 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <h3 className="mt-5 font-display text-2xl font-semibold text-primary">
              Verifying Payment
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Confirming order details with Cashfree...
            </p>
          </div>
        )}

        {!loading && result && (() => {
          const currentStatus =
            result.status === "SUCCESS"
              ? "SUCCESS"
              : result.status === "PENDING"
              ? "PENDING"
              : "FAILED";

          return (
            <div className="text-center">
              {currentStatus === "SUCCESS" && (
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf/10 text-leaf">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
              )}

              {currentStatus === "FAILED" && (
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <XCircle className="h-10 w-10" />
                </div>
              )}

              {currentStatus === "PENDING" && (
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <Clock className="h-10 w-10" />
                </div>
              )}

              <p className="eyebrow mt-4">
                {currentStatus === "SUCCESS"
                  ? "Order Confirmed"
                  : currentStatus === "FAILED"
                  ? "Transaction Incomplete"
                  : "Payment Processing"}
              </p>

              <h3
                id="payment-status-title"
                className="mt-2 font-display text-3xl font-semibold text-primary sm:text-4xl"
              >
                {currentStatus === "SUCCESS"
                  ? "Payment Successful"
                  : currentStatus === "FAILED"
                  ? "Payment Failed"
                  : "Payment Pending"}
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {currentStatus === "SUCCESS"
                  ? "Thank you for your order! Your payment has been received and verified. We are preparing your fresh Raw Makhana for dispatch."
                  : currentStatus === "FAILED"
                  ? result.message || "Your payment could not be completed or was cancelled. If any amount was deducted, your bank will automatically refund it within 3-5 business days."
                  : result.message || "Your payment is currently being processed by your bank. We will update your order once confirmed."}
              </p>

              {result.order_id && (
                <div className="mt-6 rounded-2xl border border-border/80 bg-mist/30 p-4 text-left text-xs text-muted-foreground space-y-1.5">
                  <div className="flex justify-between">
                    <span className="font-medium text-primary">Order ID:</span>
                    <span className="font-mono">{result.order_id}</span>
                  </div>
                  {result.order_amount && (
                    <div className="flex justify-between">
                      <span className="font-medium text-primary">Amount:</span>
                      <span className="font-semibold text-primary">
                        ₹{result.order_amount}
                      </span>
                    </div>
                  )}
                  {result.order_tags?.pack_size && (
                    <div className="flex justify-between">
                      <span className="font-medium text-primary">Item:</span>
                      <span>
                        {result.order_tags.quantity || 1} × {result.order_tags.pack_size} Raw Makhana
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-7 flex flex-col gap-3">
                {currentStatus === "SUCCESS" && (
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full rounded-full bg-primary px-8 py-3.5 text-xs font-medium tracking-[0.18em] text-primary-foreground uppercase shadow-[var(--shadow-soft)] transition-all hover:bg-primary/90"
                  >
                    Continue Shopping
                  </button>
                )}

                {currentStatus === "FAILED" && (
                  <>
                    <button
                      type="button"
                      onClick={handleTryAgain}
                      className="w-full rounded-full bg-primary px-8 py-3.5 text-xs font-medium tracking-[0.18em] text-primary-foreground uppercase shadow-[var(--shadow-soft)] transition-all hover:bg-primary/90"
                    >
                      Try Again
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="w-full rounded-full border border-border px-8 py-3 text-xs font-medium tracking-[0.18em] text-primary uppercase transition-all hover:bg-mist"
                    >
                      Close
                    </button>
                  </>
                )}

                {currentStatus === "PENDING" && (
                  <>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="w-full rounded-full bg-primary px-8 py-3.5 text-xs font-medium tracking-[0.18em] text-primary-foreground uppercase shadow-[var(--shadow-soft)] transition-all hover:bg-primary/90"
                    >
                      Refresh Status
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="w-full rounded-full border border-border px-8 py-3 text-xs font-medium tracking-[0.18em] text-primary uppercase transition-all hover:bg-mist"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
