import { useEffect, useState, type ReactNode } from "react";
import { PURCHASE } from "@/data/site";

type Props = {
  children: ReactNode;
  variant?: "solid" | "outline";
  className?: string;
  label?: string;
  amount?: number;
  packSize?: string;
  quantity?: number;
};

type CashfreeInstance = {
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget?: "_self" | "_blank" | "_modal";
  }) => Promise<unknown> | unknown;
};

declare global {
  interface Window {
    Cashfree?: (options: {
      mode: "sandbox" | "production";
    }) => CashfreeInstance;
  }
}

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

const emptyForm: CustomerForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

let cashfreeScriptPromise: Promise<void> | null = null;

function loadCashfree(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();

  if (cashfreeScriptPromise) return cashfreeScriptPromise;

  cashfreeScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://sdk.cashfree.com/js/v3/cashfree.js"]',
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Unable to load Cashfree checkout.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");

    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;

    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Unable to load Cashfree checkout."));

    document.head.appendChild(script);
  });

  return cashfreeScriptPromise;
}

export function BuyButton({
  children,
  variant = "solid",
  className = "",
  label,
  amount,
  packSize,
  quantity = 1,
}: Props) {
  const [notice, setNotice] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const base =
    "inline-flex items-center justify-center rounded-full px-8 py-3.5 text-xs font-medium tracking-[0.18em] uppercase transition-all duration-200 ease-out";

  const styles =
    variant === "solid"
      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-product)]"
      : "border border-primary/25 text-primary hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]";

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy]);

  const checkoutEnabled =
    typeof amount === "number" && amount > 0 && !!packSize;

  async function startCheckout(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const phone = form.phone.replace(/\D/g, "");
    const pincode = form.pincode.replace(/\D/g, "");

    if (
      !form.name.trim() ||
      !form.address.trim() ||
      !form.city.trim() ||
      !form.state.trim()
    ) {
      setError("Please fill in all delivery details.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (!/^\d{6}$/.test(pincode)) {
      setError("Enter a valid 6-digit PIN code.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    setBusy(true);

    try {
      await loadCashfree();

      const response = await fetch(
        "/.netlify/functions/create-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount,
            packSize,
            quantity,
            customer: {
              name: form.name.trim(),
              phone,
              email: form.email.trim(),
              address: form.address.trim(),
              city: form.city.trim(),
              state: form.state.trim(),
              pincode,
            },
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.payment_session_id) {
        throw new Error(
          data.error || "Unable to start payment. Please try again.",
        );
      }

      const cashfree = window.Cashfree?.({
        mode: "production",
      });

      if (!cashfree) {
        throw new Error("Cashfree checkout could not be loaded.");
      }

      await cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_self",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start payment.",
      );

      setBusy(false);
    }
  }

  function updateField(
    field: keyof CustomerForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  /*
   * If this button doesn't have payment information,
   * keep the original website behaviour.
   */
  if (!checkoutEnabled) {
    if (PURCHASE.url) {
      return (
        <a
          href={PURCHASE.url}
          aria-label={label}
          className={`${base} ${styles} ${className}`}
        >
          {children}
        </a>
      );
    }

    return (
      <span className="inline-flex flex-col items-start gap-2">
        <button
          type="button"
          aria-label={label}
          onClick={() => setNotice(true)}
          className={`${base} ${styles} ${className}`}
        >
          {children}
        </button>

        {notice && (
          <span
            role="status"
            className="max-w-xs text-xs leading-relaxed text-muted-foreground"
          >
            {PURCHASE.unavailableMessage}
          </span>
        )}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className={`${base} ${styles} ${className}`}
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-primary/35 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-title"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !busy
            ) {
              setOpen(false);
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-background p-6 shadow-2xl sm:rounded-3xl sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="eyebrow">
                  Secure checkout
                </p>

                <h2
                  id="checkout-title"
                  className="mt-2 font-display text-3xl font-semibold text-primary"
                >
                  Delivery details
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  {quantity} × {packSize} pack · ₹{amount}
                </p>
              </div>

              <button
                type="button"
                aria-label="Close checkout"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-primary disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={startCheckout}
              className="mt-7 space-y-5"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow">
                    Full name
                  </span>

                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      updateField(
                        "name",
                        e.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
                    placeholder="Your name"
                  />
                </label>

                <label className="block">
                  <span className="eyebrow">
                    Mobile
                  </span>

                  <input
                    required
                    inputMode="numeric"
                    maxLength={10}
                    value={form.phone}
                    onChange={(e) =>
                      updateField(
                        "phone",
                        e.target.value.replace(
                          /\D/g,
                          "",
                        ),
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
                    placeholder="10-digit mobile"
                  />
                </label>
              </div>

              <label className="block">
                <span className="eyebrow">
                  Email
                </span>

                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    updateField(
                      "email",
                      e.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block">
                <span className="eyebrow">
                  Delivery address
                </span>

                <textarea
                  required
                  rows={3}
                  value={form.address}
                  onChange={(e) =>
                    updateField(
                      "address",
                      e.target.value,
                    )
                  }
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
                  placeholder="House / street / area"
                />
              </label>

              <div className="grid gap-5 sm:grid-cols-3">
                <label className="block">
                  <span className="eyebrow">
                    City
                  </span>

                  <input
                    required
                    value={form.city}
                    onChange={(e) =>
                      updateField(
                        "city",
                        e.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
                  />
                </label>

                <label className="block">
                  <span className="eyebrow">
                    State
                  </span>

                  <input
                    required
                    value={form.state}
                    onChange={(e) =>
                      updateField(
                        "state",
                        e.target.value,
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
                  />
                </label>

                <label className="block">
                  <span className="eyebrow">
                    PIN code
                  </span>

                  <input
                    required
                    inputMode="numeric"
                    maxLength={6}
                    value={form.pincode}
                    onChange={(e) =>
                      updateField(
                        "pincode",
                        e.target.value.replace(
                          /\D/g,
                          "",
                        ),
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
                    placeholder="6 digits"
                  />
                </label>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-primary px-8 py-4 text-xs font-medium tracking-[0.18em] text-primary-foreground uppercase shadow-[var(--shadow-soft)] transition-all hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
              >
                {busy
                  ? "Opening secure checkout…"
                  : `Continue to payment · ₹${amount}`}
              </button>

              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                You will be redirected to Cashfree's secure payment page.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
