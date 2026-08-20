import { BRAND } from "@/data/site";
import { Reveal } from "./Reveal";

export function About() {
  return (
    <section id="about" className="bg-mist py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:gap-20 lg:px-10">
        <Reveal>
          <p className="eyebrow">About {BRAND.name}</p>
          <h2 className="mt-4 font-display text-4xl leading-[1.05] font-semibold text-primary lg:text-6xl">
            ROOTED IN TRADITION.
            <br />
            MADE FOR TODAY.
          </h2>
        </Reveal>
        <Reveal delay={120} className="space-y-5 text-base leading-relaxed text-muted-foreground">
          <p>
            {BRAND.name} is a food business built around a simple idea: bring quality Indian food
            products to customers in a clean, modern format, without changing what makes them
            good in the first place.
          </p>
          <p>
            We began with one product — Raw Makhana — and we present it plainly, with clear pack
            sizes, clear pricing and no unnecessary claims. What you see on this page is what
            arrives in the pack.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
