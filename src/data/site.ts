/**
 * Central site data. Edit prices, packs, purchase destination and contact
 * details here — nothing else in the UI hardcodes them.
 */

export const BRAND = {
  name: "SAATIVIK ANNA FOODS",
  legalName: "SAATVIK ANNA FOODS",
  udyam: "UDYAM-UP-75-0201217",
  product: "RAW MAKHANA",
} as const;

/**
 * Purchase destination. Payment is not connected yet.
 * When a checkout link becomes available, set `url` here and every
 * BUY button across the site will point to it.
 */
export const PURCHASE = {
  url: null as string | null,
  unavailableMessage: "Online checkout is opening soon. Please call or email us to order.",
} as const;

export type Pack = {
  id: string;
  size: string;
  price: number;
  priceLabel: string;
};

export const PRODUCT = {
  name: "RAW MAKHANA",
  tagline: "A simple ingredient. A timeless Indian tradition.",
  alt: "SAATIVIK ANNA FOODS Raw Makhana",
  description:
    "Raw Makhana — also known as phool makhana — is a traditional Indian food harvested from lotus ponds and long associated with the makhana-growing regions of Bihar. We keep it exactly as it should be: plain, unseasoned and ready for your kitchen.",
  packs: [
    { id: "100g", size: "100g", price: 149, priceLabel: "₹149" },
    { id: "200g", size: "200g", price: 289, priceLabel: "₹289" },
    { id: "400g", size: "400g", price: 549, priceLabel: "₹549" },
  ] satisfies Pack[],
} as const;

export const NUTRITION = [
  { value: "120", unit: "kcal", label: "Calories" },
  { value: "4", unit: "g", label: "Protein" },
  { value: "2", unit: "g", label: "Fiber" },
  { value: "150", unit: "mg", label: "Sodium" },
] as const;

export const CONTACT = {
  phone: "8303334937",
  email: "durgafunmail@gmail.com",
  addressLines: [
    "Bhadwar, Bhadwar Chauraha,",
    "Village/Town: Varanasi,",
    "Block: Birbhanpur,",
    "District: Varanasi,",
    "Uttar Pradesh - 221311",
  ],
} as const;

export const NAV = [
  { label: "HOME", href: "#home" },
  { label: "ABOUT", href: "#about" },
  { label: "RAW MAKHANA", href: "#product" },
  { label: "WHY SAATIVIK", href: "#why" },
  { label: "FAQ", href: "#faq" },
  { label: "CONTACT", href: "#contact" },
] as const;

export const FAQS = [
  {
    q: "What is Raw Makhana?",
    a: "Raw Makhana is plain, unseasoned makhana — the puffed seed of the lotus plant. It has not been flavoured or coated, so you can roast, season or cook with it exactly the way you prefer.",
  },
  {
    q: "What is phool makhana?",
    a: "Phool makhana is the common Indian name for the same ingredient. The word refers to the lotus flower the seeds come from, and it is used interchangeably with makhana across most of India.",
  },
  {
    q: "Where does makhana traditionally come from?",
    a: "Makhana is traditionally associated with the shallow ponds and wetlands of eastern India, particularly the makhana-growing districts of Bihar, where the crop has been cultivated and hand-processed for generations.",
  },
  {
    q: "How can Raw Makhana be prepared?",
    a: "It is commonly dry-roasted until crisp and then seasoned to taste. It can also be added to curries, kheer and other everyday preparations.",
  },
  {
    q: "What are the available pack sizes?",
    a: "Raw Makhana is available in 100g at ₹149, 200g at ₹289 and 400g at ₹549.",
  },
  {
    q: "How should I store Raw Makhana?",
    a: "Keep the pack closed and store it in a clean, dry container away from moisture. Any storage guidance printed on the pack should be followed.",
  },
  {
    q: "How can I contact Saatvik Anna Foods?",
    a: `You can call us on ${CONTACT.phone} or write to ${CONTACT.email}. Our registered address is listed in the footer.`,
  },
] as const;
