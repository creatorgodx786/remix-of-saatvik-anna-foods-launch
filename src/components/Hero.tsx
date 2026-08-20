import makhanaAsset from "@/assets/raw-makhana.png.asset.json";
import { BRAND, PRODUCT } from "@/data/site";
import { BuyButton } from "./BuyButton";

export function Hero() {
  return (
    <section
      id="home"
      className="relative overflow-hidden bg-gradient-to-b from-mist via-background to-background pt-28 pb-16 lg:pt-36 lg:pb-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-accent/50 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:px-10">
        <div className="animate-rise max-w-xl">
          <p className="eyebrow">{BRAND.name}</p>
          <div className="rule-gold mt-5" />
          <h1 className="mt-6 font-display text-[3.4rem] leading-[0.92] font-semibold tracking-tight text-primary sm:text-7xl lg:text-8xl">
            RAW
            <br />
            MAKHANA
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-muted-foreground">
            Pure, naturally sourced makhana rooted in India&apos;s rich food tradition.
          </p>
          <div className="mt-10 flex flex-wrap items-start gap-4">
            <BuyButton label="Shop Raw Makhana">Shop Raw Makhana</BuyButton>
            <a
              href="#product"
              className="inline-flex items-center justify-center rounded-full border border-primary/25 px-8 py-3.5 text-xs font-medium tracking-[0.18em] text-primary uppercase transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/60"
            >
              Discover More
            </a>
          </div>
        </div>

        <div className="relative flex justify-center lg:justify-end">
          <div
            aria-hidden
            className="absolute bottom-6 h-10 w-3/5 rounded-[50%] bg-primary/15 blur-2xl"
          />
          <div className="animate-product-in">
            <img
              src={makhanaAsset.url}
              alt={PRODUCT.alt}
              width={1024}
              height={1536}
              fetchPriority="high"
              className="animate-drift h-auto w-[16rem] max-w-full object-contain drop-shadow-[0_40px_60px_rgba(20,60,40,0.22)] sm:w-[20rem] lg:w-[26rem]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
