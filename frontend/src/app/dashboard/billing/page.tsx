"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

interface CurrentBilling {
  plan: string;
  price_cents: number;
  limit: number;
  stripe_customer_id: string | null;
}

interface PlanInfo {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number;
  limit: number;
  features: string[];
  popular: boolean;
}

interface Invoice {
  id: string;
  amount_cents: number;
  status: string;
  pdf_url: string | null;
  created_at: string;
}

interface InvoicesResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  per_page: number;
}

interface UsageSummary {
  month_count: number;
  month_limit: number;
}

const PLAN_DISPLAY: Record<string, { name: string; price: number; limit: number }> = {
  free: { name: "Free", price: 0, limit: 1000 },
  pro: { name: "Pro", price: 29, limit: 50000 },
  enterprise: { name: "Enterprise", price: 199, limit: 500000 },
};

export default function BillingPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [billing, setBilling] = useState<CurrentBilling | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [invoicePage, setInvoicePage] = useState(1);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Plan change modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);

  // Alerts from URL params
  const showSuccess = searchParams.get("success") === "true";
  const showCanceled = searchParams.get("canceled") === "true";

  const fetchBilling = useCallback(async () => {
    try {
      const data = await apiFetch("/api/billing/current");
      setBilling(data);
    } catch (error) {
      console.error("Failed to fetch billing:", error);
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await apiFetch("/api/pricing");
      setPlans(data.plans || []);
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const data: InvoicesResponse = await apiFetch(
        `/api/billing/invoices?page=${invoicePage}`
      );
      setInvoices(data.invoices || []);
      setInvoicesTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
      setInvoices([]);
    }
  }, [invoicePage]);

  const fetchUsage = useCallback(async () => {
    try {
      const data = await apiFetch("/api/usage/summary");
      setUsage({ month_count: data.month_count, month_limit: data.month_limit });
    } catch (error) {
      console.error("Failed to fetch usage:", error);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchBilling(), fetchPlans(), fetchInvoices(), fetchUsage()]).finally(() =>
      setLoading(false)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchInvoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoicePage]);

  const currentPlanInfo = billing ? PLAN_DISPLAY[billing.plan] || PLAN_DISPLAY.free : null;

  const handleChangePlan = async () => {
    if (!selectedPlan || !billing) return;

    const currentOrder = ["free", "pro", "enterprise"].indexOf(billing.plan);
    const targetOrder = ["free", "pro", "enterprise"].indexOf(selectedPlan);

    setChangingPlan(true);

    try {
      if (targetOrder > currentOrder) {
        // Upgrade: redirect to checkout
        const data = await apiFetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: selectedPlan }),
        });
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
          return;
        }
      } else {
        // Downgrade: show confirmation
        setShowDowngradeConfirm(true);
        setChangingPlan(false);
        return;
      }
    } catch (error) {
      console.error("Failed to change plan:", error);
    } finally {
      setChangingPlan(false);
    }
  };

  const confirmDowngrade = async () => {
    if (!selectedPlan) return;
    setChangingPlan(true);
    try {
      await apiFetch("/api/billing/downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      setShowDowngradeConfirm(false);
      setShowPlanModal(false);
      setSelectedPlan(null);
      fetchBilling();
    } catch (error) {
      console.error("Failed to downgrade:", error);
    } finally {
      setChangingPlan(false);
    }
  };

  const usagePercent =
    usage && usage.month_limit > 0
      ? Math.min(
          Math.round((usage.month_count / usage.month_limit) * 100),
          100
        )
      : 0;

  const usageBarColor =
    usagePercent > 90
      ? "bg-red-500"
      : usagePercent > 70
        ? "bg-yellow-500"
        : "bg-indigo-600";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Billing</h1>

      {/* Success / Cancel alerts */}
      {showSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm font-medium text-green-800">
            Payment successful! Your plan has been updated.
          </p>
        </div>
      )}
      {showCanceled && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-sm font-medium text-yellow-800">
            Checkout was canceled. Your plan has not been changed.
          </p>
        </div>
      )}

      {/* Current Plan Card */}
      {billing && currentPlanInfo && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Current Plan</p>
              <p className="mt-1 text-2xl font-bold capitalize text-gray-900">
                {currentPlanInfo.name}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {currentPlanInfo.price === 0
                  ? "Free"
                  : `$${currentPlanInfo.price}/month`}
                {" · "}
                {currentPlanInfo.limit.toLocaleString()} API calls/month
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedPlan(null);
                setShowPlanModal(true);
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Change Plan
            </button>
          </div>
        </div>
      )}

      {/* Usage Progress */}
      {usage && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Monthly Usage</p>
            <p className="text-sm text-gray-500">
              {usage.month_count.toLocaleString()} /{" "}
              {usage.month_limit.toLocaleString()}
            </p>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${usageBarColor}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          {usagePercent > 80 && (
            <p className="mt-2 text-xs font-medium text-red-600">
              You&apos;ve used {usagePercent}% of your monthly limit.
              {usagePercent >= 100
                ? " Consider upgrading your plan."
                : " You're approaching your limit."}
            </p>
          )}
        </div>
      )}

      {/* Invoices */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                    No invoices yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-5 py-3 text-gray-600">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      ${(inv.amount_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          inv.status === "paid"
                            ? "bg-green-50 text-green-700"
                            : inv.status === "pending"
                              ? "bg-yellow-50 text-yellow-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {inv.pdf_url ? (
                        <a
                          href={inv.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          Download PDF
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {invoicesTotal > 10 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
            <p className="text-sm text-gray-500">
              Page {invoicePage} of {Math.ceil(invoicesTotal / 10)}
            </p>
            <div className="flex gap-2">
              <button
                disabled={invoicePage <= 1}
                onClick={() => setInvoicePage((p) => p - 1)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={invoicePage * 10 >= invoicesTotal}
                onClick={() => setInvoicePage((p) => p + 1)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Change Plan Modal */}
      {showPlanModal && billing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600/50">
          <div className="mx-4 w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Change Plan
              </h3>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = plan.id === billing.plan;
                const isSelected = plan.id === selectedPlan;
                return (
                  <button
                    key={plan.id}
                    onClick={() => !isCurrent && setSelectedPlan(plan.id)}
                    disabled={isCurrent}
                    className={`relative rounded-xl border-2 p-5 text-left transition-all ${
                      isCurrent
                        ? "border-gray-300 bg-gray-50"
                        : isSelected
                          ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600"
                          : "border-gray-200 hover:border-indigo-300"
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute -top-2.5 right-3 rounded-full bg-gray-600 px-2 py-0.5 text-xs font-medium text-white">
                        Current
                      </span>
                    )}
                    <p className="text-lg font-bold capitalize text-gray-900">
                      {plan.name}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {plan.monthly_price === 0 ? "Free" : `$${plan.monthly_price / 100}`}
                      {plan.monthly_price > 0 && (
                        <span className="text-sm font-normal text-gray-500">
                          /mo
                        </span>
                      )}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      {plan.limit.toLocaleString()} calls/month
                    </p>
                    <ul className="mt-3 space-y-1">
                      {plan.features?.map((f, i) => (
                        <li
                          key={i}
                          className="text-xs text-gray-600"
                        >
                          &#10003; {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  setShowPlanModal(false);
                  setSelectedPlan(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={!selectedPlan || changingPlan}
                onClick={handleChangePlan}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {changingPlan ? "Processing..." : "Confirm Change"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Downgrade Confirmation */}
      {showDowngradeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600/50">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Confirm Downgrade
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to downgrade your plan? You may lose access
              to some features and your usage limit will be reduced at the end of
              the current billing cycle.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDowngradeConfirm(false);
                  setChangingPlan(false);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDowngrade}
                disabled={changingPlan}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {changingPlan ? "Processing..." : "Confirm Downgrade"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
