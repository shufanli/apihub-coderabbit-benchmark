"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Summary {
  today_calls: number;
  yesterday_calls: number;
  monthly_usage: number;
  monthly_limit: number;
  plan: string;
}

interface ChartPoint {
  date: string;
  calls: number;
}

interface LogEntry {
  id: string;
  time: string;
  endpoint: string;
  status: number;
  latency: number;
}

interface LogsResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  per_page: number;
}

const RANGE_OPTIONS = ["7d", "30d", "90d"] as const;
type Range = (typeof RANGE_OPTIONS)[number];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "2xx", label: "2xx Success" },
  { value: "4xx", label: "4xx Client Error" },
  { value: "5xx", label: "5xx Server Error" },
];

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-green-700 bg-green-50";
  if (status >= 300 && status < 400) return "text-blue-700 bg-blue-50";
  if (status >= 400 && status < 500) return "text-yellow-700 bg-yellow-50";
  return "text-red-700 bg-red-50";
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function DashboardOverview() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Summary
  const [summary, setSummary] = useState<Summary | null>(null);

  // Chart
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [range, setRange] = useState<Range>(
    (searchParams.get("range") as Range) || "7d"
  );

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(
    Number(searchParams.get("page")) || 1
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "all"
  );
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || ""
  );
  const [debouncedSearch, setDebouncedSearch] = useState(
    searchParams.get("search") || ""
  );

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setLogsPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Sync URL search params
  useEffect(() => {
    const params = new URLSearchParams();
    if (range !== "7d") params.set("range", range);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (logsPage > 1) params.set("page", String(logsPage));
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [range, statusFilter, debouncedSearch, logsPage, pathname, router]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const data = await apiFetch("/api/usage/summary");
      setSummary(data);
    } catch {
      // silently fail
    }
  }, []);

  // Fetch chart
  const fetchChart = useCallback(async () => {
    setChartLoading(true);
    try {
      const data = await apiFetch(`/api/usage/chart?range=${range}`);
      setChartData(data.points || []);
    } catch {
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  }, [range]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      const data: LogsResponse = await apiFetch(
        `/api/usage/logs?page=${logsPage}&status=${statusFilter}&search=${encodeURIComponent(debouncedSearch)}`
      );
      setLogs(data.logs || []);
      setLogsTotal(data.total || 0);
    } catch {
      setLogs([]);
    }
  }, [logsPage, statusFilter, debouncedSearch]);

  // Initial + refresh
  useEffect(() => {
    fetchSummary();
    fetchChart();
    fetchLogs();
  }, [fetchSummary, fetchChart, fetchLogs]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      fetchSummary();
      fetchChart();
      fetchLogs();
    }, 30000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchSummary, fetchChart, fetchLogs]);

  const changePercent =
    summary && summary.yesterday_calls > 0
      ? (
          ((summary.today_calls - summary.yesterday_calls) /
            summary.yesterday_calls) *
          100
        ).toFixed(1)
      : null;

  const usagePercent =
    summary && summary.monthly_limit > 0
      ? Math.min(
          Math.round((summary.monthly_usage / summary.monthly_limit) * 100),
          100
        )
      : 0;

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (usagePercent / 100) * circumference;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Overview</h1>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Today's Calls */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Today&apos;s Calls</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {summary ? summary.today_calls.toLocaleString() : "---"}
          </p>
          {changePercent !== null && (
            <p
              className={`mt-1 text-sm font-medium ${
                Number(changePercent) >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {Number(changePercent) >= 0 ? "+" : ""}
              {changePercent}% vs yesterday
            </p>
          )}
        </div>

        {/* Monthly Usage - circular progress */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Monthly Usage</p>
          <div className="mt-2 flex items-center gap-4">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={usagePercent > 80 ? "#ef4444" : "#6366f1"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500"
              />
              <text
                x="50"
                y="50"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-gray-900 text-lg font-bold"
                style={{ transform: "rotate(90deg)", transformOrigin: "50% 50%" }}
                fontSize="18"
              >
                {usagePercent}%
              </text>
            </svg>
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {summary
                  ? `${summary.monthly_usage.toLocaleString()} / ${summary.monthly_limit.toLocaleString()}`
                  : "---"}
              </p>
              <p className="text-sm text-gray-500">API calls this month</p>
            </div>
          </div>
        </div>

        {/* Current Plan */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Current Plan</p>
          <p className="mt-2 text-3xl font-bold capitalize text-gray-900">
            {summary?.plan || user?.plan || "---"}
          </p>
          {(summary?.plan === "free" || user?.plan === "free") && (
            <button
              onClick={() => router.push("/dashboard/billing")}
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Upgrade Plan
            </button>
          )}
        </div>
      </div>

      {/* Usage Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">API Usage</h2>
          <div className="flex rounded-lg border border-gray-200 p-0.5">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  range === r
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 h-72">
          {chartLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="calls"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: "#6366f1" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent API Logs */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent API Logs
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setLogsPage(1);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search endpoints..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Endpoint</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-8 text-center text-gray-400"
                  >
                    No logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-5 py-3 text-gray-600">
                      {new Date(log.time).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-mono text-gray-900">
                      {log.endpoint}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(log.status)}`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-600">
                      {formatLatency(log.latency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {logsTotal > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
            <p className="text-sm text-gray-500">
              Showing {(logsPage - 1) * 20 + 1}–
              {Math.min(logsPage * 20, logsTotal)} of {logsTotal}
            </p>
            <div className="flex gap-2">
              <button
                disabled={logsPage <= 1}
                onClick={() => setLogsPage((p) => p - 1)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={logsPage * 20 >= logsTotal}
                onClick={() => setLogsPage((p) => p + 1)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
