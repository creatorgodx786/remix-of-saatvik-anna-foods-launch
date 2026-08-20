import logoAsset from "@/assets/saatvik-logo.png.asset.json";
import { BRAND, CONTACT, NAV } from "@/data/site";

export function Footer() {
  return (
    <footer className="border-t border-border bg-mist py-16">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr_1fr]">
          <div>
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={logoAsset.url}
                alt={`${BRAND.name} logo`}
                width={56}
                height={56}
                loading="lazy"
                className="h-14 w-14 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold tracking-[0.12em] text-primary">
                  {BRAND.name}
                </p>
                <p className="text-xs tracking-[0.24em] text-muted-foreground uppercase">
                  {BRAND.product}
                </p>
              </div>
            </div>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Pure, naturally sourced makhana rooted in India&apos;s rich food tradition.
            </p>
          </div>

          <nav aria-label="Footer">
            <p className="eyebrow">Explore</p>
            <ul className="mt-5 space-y-3">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-sm text-primary/75 transition-colors hover:text-primary"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="eyebrow">Contact</p>
            <address className="mt-5 space-y-2 text-sm leading-relaxed text-foreground/80 not-italic">
              <a href={`tel:${CONTACT.phone}`} className="block hover:text-primary">
                {CONTACT.phone}
              </a>
              <a href={`mailto:${CONTACT.email}`} className="block break-all hover:text-primary">
                {CONTACT.email}
              </a>
              <span className="block pt-2">
                {CONTACT.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </address>
          </div>
        </div>

        <div className="mt-14 grid gap-6 border-t border-border pt-8 text-xs leading-relaxed text-muted-foreground lg:grid-cols-2">
          <div>
            <p className="tracking-[0.2em] uppercase">Business details</p>
            <p className="mt-2 text-sm text-foreground/80">Registered enterprise name: {BRAND.legalName}</p>
            <p className="text-sm text-foreground/80">Udyam Registration Number: {BRAND.udyam}</p>
          </div>
          <div>
            <p className="tracking-[0.2em] uppercase">Returns</p>
            <p className="mt-2">
              We do not accept returns on Raw Makhana orders. If something is wrong with your
              order, please contact us using the details above.
            </p>
          </div>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
