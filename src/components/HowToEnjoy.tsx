import { Reveal } from "./Reveal";

const WAYS = [
  { title: "ROAST IT", text: "Season and roast for a crisp snack." },
  { title: "SEASON IT", text: "Add your preferred spices and flavors." },
  { title: "SNACK IT", text: "Enjoy as an everyday snack." },
  { title: "COOK WITH IT", text: "Use makhana in different recipes and preparations." },
];

export function HowToEnjoy() {
  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Everyday use</p>
          <h2 className="mt-4 font-display text-4xl leading-tight font-semibold text-primary lg:text-6xl">
            HOW DO YOU LIKE
            <br />
            YOUR MAKHANA?
          </h2>
        </Reveal>

        <ul className="mt-14 divide-y divide-border border-y border-border">
          {WAYS.map((w, i) => (
            <Reveal as="li" key={w.title} delay={i * 90}>
              <div className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 py-7 transition-colors duration-500 hover:bg-mist sm:flex sm:justify-between sm:px-4">
                <div className="min-w-0">
                  <h3 className="font-display text-2xl font-semibold text-primary transition-transform duration-500 group-hover:translate-x-2 lg:text-4xl">
                    {w.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{w.text}</p>
                </div>
                <span className="shrink-0 font-display text-lg text-gold">0{i + 1}</span>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
