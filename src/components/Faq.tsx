import { useState } from "react";
import { Plus } from "lucide-react";
import { FAQS } from "@/data/site";
import { Reveal } from "./Reveal";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 lg:py-28">
      <div className="mx-auto max-w-4xl px-5 lg:px-10">
        <Reveal>
          <p className="eyebrow">Questions</p>
          <h2 className="mt-4 font-display text-4xl font-semibold text-primary lg:text-6xl">FAQ</h2>
        </Reveal>

        <div className="mt-12 border-t border-border">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="border-b border-border">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-6 text-left"
                  >
                    <span className="min-w-0 font-display text-xl text-primary lg:text-2xl">
                      {f.q}
                    </span>
                    <Plus
                      className={`h-4 w-4 shrink-0 text-gold transition-transform duration-500 ${isOpen ? "rotate-45" : ""}`}
                    />
                  </button>
                </h3>
                <div
                  className="grid transition-all duration-500 ease-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="pr-8 pb-6 text-sm leading-relaxed text-muted-foreground">
                      {f.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
