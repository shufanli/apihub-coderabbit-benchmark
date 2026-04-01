import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - ApiHub",
  description:
    "Choose the right ApiHub plan for your needs. Free, Pro, and Enterprise plans with flexible monthly and yearly billing.",
  openGraph: {
    title: "Pricing - ApiHub",
    description:
      "Affordable API management plans. Start free with 1,000 calls/month or scale with Pro and Enterprise.",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
