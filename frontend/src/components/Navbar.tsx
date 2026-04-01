"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Logo */}
          <Link
            href="/pricing"
            className="text-xl font-bold tracking-tight text-indigo-600"
          >
            ApiHub
          </Link>

          {/* Right: Desktop nav */}
          <div className="hidden items-center gap-4 sm:flex">
            {loading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-gray-100" />
            ) : user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors"
                >
                  Logout
                </button>
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="h-8 w-8 rounded-full ring-2 ring-indigo-100"
                />
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 sm:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-gray-200 sm:hidden">
          <div className="space-y-1 px-4 pb-4 pt-3">
            {loading ? (
              <div className="h-8 w-full animate-pulse rounded bg-gray-100" />
            ) : user ? (
              <>
                <div className="flex items-center gap-3 pb-3">
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="h-8 w-8 rounded-full ring-2 ring-indigo-100"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {user.username}
                  </span>
                </div>
                <Link
                  href="/dashboard"
                  className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="block rounded-md px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
