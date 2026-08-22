import { createFileRoute } from "@tanstack/react-router";
import { PaymentStatusModal } from "@/components/PaymentStatusModal";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { ProductSection } from "@/components/ProductSection";
import { Story } from "@/components/Story";
import { Benefits } from "@/components/Benefits";
import { HowToEnjoy } from "@/components/HowToEnjoy";
import { Nutrition } from "@/components/Nutrition";
import { Quality } from "@/components/Quality";
import { About } from "@/components/About";
import { Faq } from "@/components/Faq";
import { Purchase } from "@/components/Purchase";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";

const title = "SAATIVIK ANNA FOODS — Raw Makhana from India";
const description =
  "Pure, naturally sourced Raw Makhana from SAATIVIK ANNA FOODS. Plain phool makhana in 100g, 200g and 400g packs, rooted in India's food tradition.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <PaymentStatusModal />
      <Navbar />
      <main>
        <Hero />
        <ProductSection />
        <Story />
        <Benefits />
        <HowToEnjoy />
        <Nutrition />
        <Quality />
        <About />
        <Faq />
        <Purchase />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
