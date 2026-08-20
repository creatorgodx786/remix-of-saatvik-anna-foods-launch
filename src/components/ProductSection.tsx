import { useState } from "react";
import makhanaAsset from "@/assets/raw-makhana.png.asset.json";
import { PRODUCT } from "@/data/site";
import { BuyButton } from "./BuyButton";
import { Reveal } from "./Reveal";

export function ProductSection() {
  const packs = PRODUCT.packs as readonly { id: string; size: string; priceLabel: string }[];
  const [selected, setSelected] = useState(packs[1]!.id);
  const pack = packs.find((p) => p.id === selected) ?? packs[0]!;

  return (
    <section id="product" className="border-y border-border/60 bg-cream py-20 lg:py-28">
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
          <Reveal className="flex justify-center">
            <div className="relative flex w-full max-w-xl items-center justify-center rounded-3xl bg-background p-10 shadow-[var(--shadow-soft)]">
              <img
                src={makhanaAsset.url}
                alt={PRODUCT.alt}
                width={1024}
                height={1536}
                loading="lazy"
                className="product-hover h-auto w-full max-w-[24rem] object-contain"
              />
            </div>
          </Reveal>

          <Reveal delay={120}>
            <p className="text-base leading-relaxed text-muted-foreground lg:text-lg">
              {PRODUCT.description}
            </p>

            <fieldset className="mt-10">
              <legend className="eyebrow mb-4">Select pack size</legend>
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
                        className={`mt-1 block text-sm tracking-[0.1em] ${active ? "text-gold-soft" : "text-muted-foreground"}`}
                      >
                        {p.priceLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-10 flex flex-wrap items-end gap-8">
              <div key={pack.id} className="animate-price">
                <p className="eyebrow">Price</p>
                <p className="mt-1 font-display text-6xl font-semibold text-primary">
                  {pack.priceLabel}
                </p>
                <p className="mt-1 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                  {pack.size} pack
                </p>
              </div>
              <BuyButton label={`Buy Raw Makhana ${pack.size}`}>Buy Now</BuyButton>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
