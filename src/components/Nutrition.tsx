import { NUTRITION } from "@/data/site";
import { Reveal } from "./Reveal";

export function Nutrition() {
  return (
    <section className="bg-primary py-20 text-primary-foreground lg:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <Reveal className="max-w-xl">
          <p className="text-[0.72rem] tracking-[0.32em] text-primary-foreground/60 uppercase">
            Reference values
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold lg:text-5xl">NUTRITION</h2>
        </Reveal>

        <dl className="mt-12 grid grid-cols-2 gap-y-12 lg:grid-cols-4">
          {NUTRITION.map((n, i) => (
            <Reveal key={n.label} delay={i * 100}>
              <div className="border-l border-primary-foreground/20 pl-5">
                <dt className="text-[0.7rem] tracking-[0.24em] text-primary-foreground/60 uppercase">
                  {n.label}
                </dt>
                <dd className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-semibold text-gold-soft lg:text-6xl">
                    {n.value}
                  </span>
                  <span className="text-sm tracking-[0.18em] text-primary-foreground/70 uppercase">
                    {n.unit}
                  </span>
                </dd>
              </div>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
