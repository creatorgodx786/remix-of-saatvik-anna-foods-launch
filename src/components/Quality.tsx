import { Reveal } from "./Reveal";

const POINTS = [
  { title: "CAREFULLY SELECTED", text: "Seeds chosen with attention to size and appearance." },
  { title: "GRADING & SELECTION", text: "Sorted so that what reaches the pack stays consistent." },
  { title: "ATTENTION TO PURITY", text: "Kept plain — no flavouring, no coating, no additions." },
  { title: "TRADITIONAL ROOTS", text: "An ingredient handled the way it has long been handled." },
  { title: "QUALITY-FOCUSED HANDLING", text: "Careful packing so the makhana stays intact and dry." },
];

export function Quality() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <Reveal className="max-w-xl">
          <p className="eyebrow">Standards</p>
          <h2 className="mt-4 font-display text-4xl font-semibold text-primary lg:text-6xl">
            QUALITY YOU CAN SEE
          </h2>
          <div className="rule-gold mt-6" />
        </Reveal>

        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl bg-border sm:grid-cols-2 lg:grid-cols-3">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <article className="h-full bg-background p-7 transition-all duration-500 hover:bg-mist lg:p-8">
                <h3 className="text-sm font-medium tracking-[0.2em] text-primary uppercase">
                  {p.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
