import { Mail, MapPin, Phone } from "lucide-react";
import { CONTACT } from "@/data/site";
import { Reveal } from "./Reveal";

export function Contact() {
  return (
    <section id="contact" className="py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-10">
        <Reveal>
          <p className="eyebrow">Get in touch</p>
          <h2 className="mt-4 font-display text-4xl font-semibold text-primary lg:text-6xl">
            CONTACT
          </h2>
          <div className="rule-gold mt-6" />
        </Reveal>

        <Reveal delay={120}>
          <dl className="grid gap-8 sm:grid-cols-2">
            <div className="flex min-w-0 gap-4">
              <Phone className="mt-1 h-4 w-4 shrink-0 text-gold" />
              <div className="min-w-0">
                <dt className="eyebrow">Phone</dt>
                <dd className="mt-2 text-lg text-primary">
                  <a href={`tel:${CONTACT.phone}`} className="hover:text-leaf">
                    {CONTACT.phone}
                  </a>
                </dd>
              </div>
            </div>
            <div className="flex min-w-0 gap-4">
              <Mail className="mt-1 h-4 w-4 shrink-0 text-gold" />
              <div className="min-w-0">
                <dt className="eyebrow">Email</dt>
                <dd className="mt-2 truncate text-lg text-primary">
                  <a href={`mailto:${CONTACT.email}`} className="hover:text-leaf">
                    {CONTACT.email}
                  </a>
                </dd>
              </div>
            </div>
            <div className="flex min-w-0 gap-4 sm:col-span-2">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-gold" />
              <div className="min-w-0">
                <dt className="eyebrow">Address</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {CONTACT.addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </dd>
              </div>
            </div>
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
