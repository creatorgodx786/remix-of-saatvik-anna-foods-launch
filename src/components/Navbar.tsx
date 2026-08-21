import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import logoAsset from "@/assets/saatvik-logo.png.asset.json";
import { BRAND, NAV } from "@/data/site";
import { BuyButton } from "./BuyButton";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-background/90 backdrop-blur-md border-b border-border/70" : "bg-transparent"
      }`}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 lg:grid-cols-[auto_1fr_auto] lg:gap-10 lg:px-10">
        <a href="#home" className="flex min-w-0 items-center gap-3">
          <img
            src={logoAsset.url}
            alt={`${BRAND.name} logo`}
            width={48}
            height={48}
            className="h-11 w-11 shrink-0 object-contain"
          />
          <span className="min-w-0 truncate font-display text-base leading-none font-semibold tracking-[0.14em] text-primary sm:text-lg">
            {BRAND.name}
          </span>
        </a>

        <nav aria-label="Main" className="hidden items-center justify-center gap-8 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[0.68rem] font-medium tracking-[0.22em] text-primary/70 uppercase transition-colors hover:text-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden lg:block">
            <a
              href="#buy"
              aria-label="Go to purchase section"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-xs font-medium tracking-[0.18em] text-primary-foreground uppercase shadow-[var(--shadow-soft)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[var(--shadow-product)]"
            >
              Buy Now
            </a>
          </div>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-primary lg:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          aria-label="Mobile"
          className="border-t border-border bg-background px-5 py-6 lg:hidden"
        >
          <ul className="flex flex-col gap-5">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="text-xs tracking-[0.22em] text-primary uppercase"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <a
              href="#buy"
              onClick={() => setOpen(false)}
              aria-label="Go to purchase section"
              className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3.5 text-xs font-medium tracking-[0.18em] text-primary-foreground uppercase shadow-[var(--shadow-soft)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-primary/90"
            >
              Buy Now
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
