"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

const PERMISSIONS = [
  { id: "read", label: "Read", description: "Read access to API resources" },
  { id: "write", label: "Write", description: "Create and update resources" },
  { id: "delete", label: "Delete", description: "Delete resources" },
  { id: "admin", label: "Admin", description: "Full administrative access" },
];

export default function ApiKeysPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [keyName, setKeyName] = useState("");
  const [keyDescription, setKeyDescription] = useState("");
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyCopied, setNewKeyCopied] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const data = await apiFetch("/api/keys");
      setKeys(data.keys || []);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/keys/${deleteId}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== deleteId));
    } catch {
      // error handling
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const togglePermission = (id: string) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const data = await apiFetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName,
          description: keyDescription,
          permissions: Array.from(permissions),
        }),
      });
      setNewKeyValue(data.key);
      setCreateStep(3);
      fetchKeys();
    } catch {
      // error handling
    } finally {
      setCreating(false);
    }
  };

  const resetCreateModal = () => {
    setShowCreate(false);
    setCreateStep(1);
    setKeyName("");
    setKeyDescription("");
    setPermissions(new Set());
    setNewKeyValue("");
    setNewKeyCopied(false);
  };

  const canCloseStep3 = newKeyCopied;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          + Create New Key
        </button>
      </div>

      {/* Keys Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Key</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Last Used</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                    No API keys yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {k.name}
                    </td>
                    <td className="px-5 py-3 font-mono text-gray-600">
                      {k.key_prefix}...
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-600">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-600">
                      {k.last_used_at
                        ? new Date(k.last_used_at).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(k.key_prefix, k.id)}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          {copiedId === k.id ? "Copied!" : "Copy"}
                        </button>
                        <button
                          onClick={() => setDeleteId(k.id)}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600/50">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete API Key</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete this key? This action cannot be
              undone. Any applications using this key will lose access.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Key Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-xl">
            {/* Step indicators */}
            <div className="flex border-b border-gray-200 px-6 pt-5">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex flex-1 flex-col items-center pb-3">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      s === createStep
                        ? "bg-indigo-600 text-white"
                        : s < createStep
                          ? "bg-indigo-100 text-indigo-600"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {s}
                  </div>
                  <span className="mt-1 text-xs text-gray-500">
                    {s === 1 ? "Details" : s === 2 ? "Permissions" : "API Key"}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-6">
              {/* Step 1: Name + Description */}
              {createStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="e.g., Production API Key"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      value={keyDescription}
                      onChange={(e) => setKeyDescription(e.target.value)}
                      placeholder="Optional description..."
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={resetCreateModal}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!keyName.trim()}
                      onClick={() => setCreateStep(2)}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Permissions */}
              {createStep === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Select at least one permission for this key.
                  </p>
                  <div className="space-y-3">
                    {PERMISSIONS.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={permissions.has(p.id)}
                          onChange={() => togglePermission(p.id)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {p.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            {p.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setCreateStep(1)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      disabled={permissions.size === 0 || creating}
                      onClick={handleCreate}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {creating ? "Creating..." : "Create"}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Show key */}
              {createStep === 3 && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                    <p className="text-sm font-medium text-yellow-800">
                      This is the only time you&apos;ll see this key. Please copy
                      it now and store it securely.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 overflow-x-auto rounded-lg bg-gray-100 px-3 py-2.5 font-mono text-sm text-gray-900">
                      {newKeyValue}
                    </code>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(newKeyValue);
                        setNewKeyCopied(true);
                      }}
                      className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                        newKeyCopied
                          ? "bg-green-600 text-white"
                          : "bg-indigo-600 text-white hover:bg-indigo-700"
                      }`}
                    >
                      {newKeyCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      disabled={!canCloseStep3}
                      onClick={resetCreateModal}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
