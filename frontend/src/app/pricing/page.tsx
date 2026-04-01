"use client";

import { useState } from "react";
import Link from "next/link";

const plans = [
  {
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    calls: "1,000",
    cta: "Get Started",
    badge: null,
    features: [
      "1,000 API calls / month",
      "Basic analytics",
      "Community support",
      "Standard rate limits",
      "Public API access",
    ],
  },
  {
    name: "Pro",
    monthlyPrice: 29,
    yearlyPrice: 24,
    calls: "50,000",
    cta: "Start Free Trial",
    badge: "Most Popular",
    features: [
      "50,000 API calls / month",
      "Advanced analytics & logs",
      "Priority email support",
      "Higher rate limits",
      "Webhook integrations",
      "Custom API keys",
    ],
  },
  {
    name: "Enterprise",
    monthlyPrice: 199,
    yearlyPrice: 166,
    calls: "500,000",
    cta: "Contact Sales",
    badge: null,
    features: [
      "500,000 API calls / month",
      "Real-time analytics dashboard",
      "Dedicated account manager",
      "Custom rate limits",
      "SSO & team management",
      "SLA guarantee",
      "On-premise deployment option",
    ],
  },
];

const faqs = [
  {
    question: "How does the free plan work?",
    answer:
      "You get 1,000 free API calls per month with no credit card required. Simply sign up and start making API calls immediately. If you exceed the limit, calls will be paused until the next billing cycle.",
  },
  {
    question: "Can I upgrade or downgrade anytime?",
    answer:
      "Yes, you can change your plan at any time. Upgrades take effect immediately with prorated billing, while downgrades take effect at the end of your current billing cycle.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express) via Stripe. All transactions are processed securely.",
  },
  {
    question: "Is there an API rate limit?",
    answer:
      "Yes, rate limits vary by plan to ensure fair usage and optimal performance for all users. Detailed rate limit information is documented in our API docs for each plan tier.",
  },
  {
    question: "Do you offer custom enterprise plans?",
    answer:
      "Absolutely! If your needs exceed our standard Enterprise plan or you require custom features, please contact our sales team. We'll work with you to create a tailored solution.",
  },
];

function CheckIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-indigo-600"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
}

function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        className="flex w-full items-center justify-between py-5 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-base font-medium text-gray-900">{question}</span>
        <ChevronIcon open={open} />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-40 pb-5" : "max-h-0"
        }`}
      >
        <p className="text-sm leading-relaxed text-gray-600">{answer}</p>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="mx-auto max-w-4xl px-6 pt-20 pb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Choose the plan that fits your needs. Scale as you grow.
        </p>

        {/* Billing toggle */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span
            className={`text-sm font-medium ${
              !yearly ? "text-gray-900" : "text-gray-500"
            }`}
          >
            Monthly
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={yearly}
            onClick={() => setYearly(!yearly)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
              yearly ? "bg-indigo-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-300 ease-in-out ${
                yearly ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium ${
              yearly ? "text-gray-900" : "text-gray-500"
            }`}
          >
            Yearly
            <span className="ml-1.5 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              Save 17%
            </span>
          </span>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => {
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
            const isPopular = plan.badge !== null;

            return (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  isPopular
                    ? "border-indigo-600 shadow-lg shadow-indigo-100 ring-1 ring-indigo-600"
                    : "border-gray-200"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-indigo-600 px-4 py-1 text-xs font-semibold text-white">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {plan.name}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {plan.calls} API calls / month
                  </p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold tracking-tight text-gray-900">
                    ${price}
                  </span>
                  <span className="text-sm text-gray-500">/mo</span>
                  {yearly && plan.monthlyPrice > 0 && (
                    <p className="mt-1 text-xs text-gray-400 line-through">
                      ${plan.monthlyPrice}/mo
                    </p>
                  )}
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckIcon />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/login"
                  className={`block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                    isPopular
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-white text-indigo-600 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-50"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ section */}
      <div className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 text-center mb-10">
          Frequently asked questions
        </h2>
        <div className="divide-y divide-gray-200 border-t border-gray-200">
          {faqs.map((faq) => (
            <FAQItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
