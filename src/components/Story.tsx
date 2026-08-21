import { Reveal } from "./Reveal";

const STEPS = [
  { label: "ROOTED", text: "Lotus plants take hold in shallow ponds and wetlands." },
  { label: "HARVESTED", text: "Seeds are gathered by hand, as they traditionally have been." },
  { label: "SELECTED", text: "Seeds are sorted and graded before they move on." },
  { label: "PACKED", text: "Packed plain and unseasoned, ready for your kitchen." },
];

export function Story() {
  return (
    <section id="story" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <Reveal>
            <p className="eyebrow">Origin</p>
            <h2 className="mt-4 font-display text-4xl leading-[1.02] font-semibold text-primary lg:text-6xl">
              FROM THE WETLANDS
              <br />
              OF BIHAR
            </h2>
            <div className="rule-gold mt-6" />
            <figure className="mt-8 overflow-hidden rounded-3xl">
              <img
                src="/images/bihar-wetlands.webp"
                alt="Lotus wetlands where makhana is traditionally harvested"
                loading="lazy"
                className="h-64 w-full object-cover transition-transform duration-700 ease-out hover:scale-[1.03] lg:h-80"
              />
            </figure>
          </Reveal>
          <Reveal delay={100} className="space-y-5 text-base leading-relaxed text-muted-foreground">
            <p>
              Makhana grows in still water. Across the shallow ponds and low wetlands of Bihar,
              the lotus plant has been cultivated for generations, and the seeds it produces are
              collected, dried and popped using methods passed down within farming families.
            </p>
            <p>
              This is the tradition our Raw Makhana belongs to — a food shaped by water, patience
              and hand-work rather than machinery. We share this story as background to the
              ingredient itself, not as a claim about any single farm or batch.
            </p>
          </Reveal>
        </div>

        <ol className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.label} delay={i * 120}>
              <div className="h-full border-t border-border pt-6">
                <span className="font-display text-sm text-gold">0{i + 1}</span>
                <h3 className="mt-3 text-sm font-medium tracking-[0.22em] text-primary uppercase">
                  {s.label}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
