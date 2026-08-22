import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { PRODUCT } from "@/data/site";
import { Reveal } from "./Reveal";

type CheckoutDetails = {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

export function ProductSection() {
  const packs = PRODUCT.packs as readonly {
    id: string;
    size: string;
    price: number;
    priceLabel: string;
  }[];

  const [selected, setSelected] = useState(packs[1]?.id ?? packs[0]!.id);
  const [qty, setQty] = useState(1);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [details, setDetails] = useState<CheckoutDetails>({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  const pack = packs.find((p) => p.id === selected) ?? packs[0]!;
  const total = pack.price * qty;

  const updateDetail = (field: keyof CheckoutDetails, value: string) => {
    setDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const openCheckout = () => {
    setError("");
    setCheckoutOpen(true);
  };

  const startPayment = async () => {
    setError("");

    if (!details.name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(details.phone)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (!details.address.trim()) {
      setError("Please enter your delivery address.");
      return;
    }

    if (!details.city.trim()) {
      setError("Please enter your city.");
      return;
    }

    if (!details.state.trim()) {
      setError("Please enter your state.");
      return;
    }

    if (!/^\d{6}$/.test(details.pincode)) {
      setError("Please enter a valid 6-digit PIN code.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/.netlify/functions/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: total,
          packSize: pack.size,
          quantity: qty,
          customer: details,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create payment.");
      }

      const loadCashfree = () => {
        return new Promise<void>((resolve, reject) => {
          if ((window as any).Cashfree) {
            resolve();
            return;
          }

          const script = document.createElement("script");
          script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
          script.async = true;

          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error("Unable to load Cashfree checkout."));

          document.body.appendChild(script);
        });
      };

      await loadCashfree();

      const cashfree = (window as any).Cashfree({
        mode: "production",
      });

      await cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_self",
      });
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <>
      <section
        id="product"
        className="border-y border-border/60 bg-cream py-20 lg:py-28"
      >
        <div className="mx-auto max-w-7xl px-5 lg:px-10">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">The Product</p>

            <h2 className="mt-4 font-display text-5xl leading-none font-semibold text-primary lg:text-7xl">
              RAW MAKHANA
            </h2>

            <p className="mt-4 font-display text-xl text-leaf italic lg:text-2xl">
              {PRODUCT.tagline}
            </p>
          </Reveal>

          <div className="mt-14 grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
            <Reveal className="flex flex-col items-center gap-6">
              <div className="relative flex w-full max-w-xl items-center justify-center rounded-3xl bg-background p-10 shadow-[var(--shadow-soft)]">
                <img
                  src="/images/raw-makhana.png"
                  alt={PRODUCT.alt}
                  width={1024}
                  height={1536}
                  loading="lazy"
                  className="product-hover h-auto w-full max-w-[24rem] object-contain"
                />
              </div>

              <figure className="w-full max-w-xl overflow-hidden rounded-3xl">
                <img
                  src="/images/raw-makhana-bowl.webp"
                  alt="A bowl of raw makhana beside fresh leaves"
                  loading="lazy"
                  className="h-56 w-full object-cover transition-transform duration-700 ease-out hover:scale-[1.03] lg:h-64"
                />
              </figure>
            </Reveal>

            <Reveal delay={120}>
              <p className="text-base leading-relaxed text-muted-foreground lg:text-lg">
                {PRODUCT.description}
              </p>
              <p className="mt-3 text-sm text-primary/80 font-medium">
                Secure online checkout available. Choose your pack and order directly.
              </p>

              <fieldset className="mt-10">
                <legend className="eyebrow mb-4">
                  Select pack size
                </legend>

                <div className="flex flex-wrap gap-3">
                  {packs.map((p) => {
                    const active = p.id === selected;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelected(p.id)}
                        className={`min-w-[7.5rem] rounded-2xl border px-5 py-4 text-left transition-all duration-300 ease-out ${
                          active
                            ? "-translate-y-0.5 border-primary bg-primary text-primary-foreground shadow-[var(--shadow-soft)] ring-1 ring-gold/40"
                            : "border-border bg-background text-primary hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[var(--shadow-soft)]"
                        }`}
                      >
                        <span className="block text-base font-medium tracking-[0.14em]">
                          {p.size}
                        </span>

                        <span
                          className={`mt-1 block text-sm tracking-[0.1em] ${
                            active
                              ? "text-gold-soft"
                              : "text-muted-foreground"
                          }`}
                        >
                          {p.priceLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-10">
                <p className="eyebrow mb-4">Quantity</p>

                <div className="inline-flex items-center gap-5 rounded-full border border-border bg-background px-3 py-2">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() =>
                      setQty((q) => Math.max(1, q - 1))
                    }
                    disabled={qty <= 1}
                    className="grid h-9 w-9 place-items-center rounded-full text-primary transition-colors duration-200 hover:bg-mist disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <span
                    aria-live="polite"
                    className="min-w-[2ch] text-center text-base text-primary"
                  >
                    {qty}
                  </span>

                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() =>
                      setQty((q) => Math.min(99, q + 1))
                    }
                    className="grid h-9 w-9 place-items-center rounded-full text-primary transition-colors duration-200 hover:bg-mist"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-10 flex flex-wrap items-end gap-8">
                <div key={`${pack.id}-${qty}`} className="animate-price">
                  <p className="eyebrow">Total</p>

                  <p className="mt-1 font-display text-6xl font-semibold text-primary">
                    ₹{total}
                  </p>

                  <p className="mt-1 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    {qty} × {pack.size} pack · {pack.priceLabel} each
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openCheckout}
                  className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3.5 text-xs font-medium tracking-[0.18em] text-primary-foreground uppercase shadow-[var(--shadow-soft)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[var(--shadow-product)]"
                >
                  Buy Now
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {checkoutOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-background p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => {
                if (!loading) {
                  setCheckoutOpen(false);
                  setError("");
                }
              }}
              disabled={loading}
              aria-label="Close checkout"
              className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-mist disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>

            <p className="eyebrow">Delivery details</p>

            <h3 className="mt-3 font-display text-4xl font-semibold text-primary">
              Complete your order
            </h3>

            <p className="mt-2 text-sm text-muted-foreground">
              {qty} × {pack.size} · Total ₹{total}
            </p>

            <div className="mt-7 space-y-4">
              <input
                value={details.name}
                onChange={(e) =>
                  updateDetail("name", e.target.value)
                }
                placeholder="Full name"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
              />

              <input
                value={details.phone}
                onChange={(e) =>
                  updateDetail(
                    "phone",
                    e.target.value.replace(/\D/g, "").slice(0, 10)
                  )
                }
                placeholder="Mobile number"
                inputMode="numeric"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
              />

              <textarea
                value={details.address}
                onChange={(e) =>
                  updateDetail("address", e.target.value)
                }
                placeholder="Full delivery address"
                rows={3}
                className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={details.city}
                  onChange={(e) =>
                    updateDetail("city", e.target.value)
                  }
                  placeholder="City"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
                />

                <input
                  value={details.state}
                  onChange={(e) =>
                    updateDetail("state", e.target.value)
                  }
                  placeholder="State"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
                />
              </div>

              <input
                value={details.pincode}
                onChange={(e) =>
                  updateDetail(
                    "pincode",
                    e.target.value.replace(/\D/g, "").slice(0, 6)
                  )
                }
                placeholder="PIN code"
                inputMode="numeric"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
              />
            </div>

            {error && (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={startPayment}
              disabled={loading}
              className="mt-6 w-full rounded-full bg-primary px-8 py-4 text-sm font-medium tracking-[0.12em] text-primary-foreground uppercase transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Opening secure checkout..."
                : `Pay ₹${total}`}
            </button>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              You will be redirected to Cashfree's secure payment page.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
