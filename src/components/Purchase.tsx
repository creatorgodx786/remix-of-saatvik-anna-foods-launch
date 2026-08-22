import { PRODUCT } from "@/data/site";
import { BuyButton } from "./BuyButton";
import { Reveal } from "./Reveal";

export function Purchase() {
  return (
    <section id="buy" className="bg-cream py-20 lg:py-28">
      <div className="mx-auto max-w-4xl px-5 text-center lg:px-10">
        <Reveal>
          <p className="eyebrow">Order</p>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl leading-[1.05] font-semibold text-primary lg:text-6xl">
            BRING HOME THE GOODNESS OF RAW MAKHANA
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Secure online checkout available. Choose your pack and order directly.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <ul className="mt-12 grid gap-4 sm:grid-cols-3">
            {PRODUCT.packs.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-border bg-background px-6 py-7 transition-all duration-500 hover:-translate-y-1 hover:border-gold/60"
              >
                <p className="text-xs tracking-[0.24em] text-muted-foreground uppercase">
                  {p.size}
                </p>
                <p className="mt-2 font-display text-4xl font-semibold text-primary">
                  {p.priceLabel}
                </p>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={200} className="mt-12 flex justify-center">
          <BuyButton label="Buy Raw Makhana">Buy Raw Makhana</BuyButton>
        </Reveal>
      </div>
    </section>
  );
}
