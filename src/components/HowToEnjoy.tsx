import { Reveal } from "./Reveal";

const WAYS = [
  {
    title: "ROAST IT",
    text: "Season and roast for a crisp snack.",
    img: "/images/roast-it.webp",
    alt: "Roasted makhana in a ceramic bowl",
  },
  {
    title: "SEASON IT",
    text: "Add your preferred spices and flavors.",
    img: "/images/season-it.webp",
    alt: "Seasoned makhana in a wooden bowl",
  },
  {
    title: "SNACK IT",
    text: "Enjoy as an everyday snack.",
    img: "/images/snack-it.webp",
    alt: "Plain makhana served in a bowl as a snack",
  },
  {
    title: "COOK WITH IT",
    text: "Use makhana in different recipes and preparations.",
    img: "/images/cook-with-it.webp",
    alt: "Makhana cooked in a curry",
  },
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

        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WAYS.map((w, i) => (
            <Reveal as="li" key={w.title} delay={i * 90}>
              <article className="group h-full overflow-hidden rounded-2xl border border-border/70 bg-background transition-all duration-500 hover:-translate-y-1 hover:border-gold/50 hover:shadow-[var(--shadow-soft)]">
                <div className="overflow-hidden">
                  <img
                    src={w.img}
                    alt={w.alt}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <div className="p-6">
                  <span className="font-display text-sm text-gold">0{i + 1}</span>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-primary">
                    {w.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.text}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
