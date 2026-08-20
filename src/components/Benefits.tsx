import macroAsset from "@/assets/macro-raw-makhana.png.asset.json";
import { Reveal } from "./Reveal";

const ITEMS = [
  { title: "LIGHT", text: "A naturally light snack ingredient." },
  { title: "CRUNCHY", text: "Known for its characteristic crisp texture when prepared." },
  { title: "VERSATILE", text: "Can be roasted, seasoned or incorporated into recipes." },
  { title: "TRADITIONAL", text: "A food with deep roots in Indian culinary tradition." },
];

export function Benefits() {
  return (
    <section id="why" className="bg-mist py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <Reveal className="max-w-xl">
          <p className="eyebrow">Why Saativik</p>
          <h2 className="mt-4 font-display text-4xl font-semibold text-primary lg:text-6xl">
            WHY RAW MAKHANA?
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i * 100}>
              <article className="h-full rounded-2xl border border-border/70 bg-background p-8 transition-all duration-500 hover:-translate-y-1 hover:border-gold/50 hover:shadow-[var(--shadow-soft)]">
                <h3 className="font-display text-2xl font-semibold tracking-wide text-primary">
                  {item.title}
                </h3>
                <div className="rule-gold mt-4" />
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
