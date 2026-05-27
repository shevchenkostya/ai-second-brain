"use client";

import { useAdminUsers, usePatchAdminUser, useDeleteAdminUser, useForceVerifyUser } from "@/lib/queries/admin";
import { useUIStore } from "@/store/ui";
import type { AdminUser } from "@/lib/api";

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
      role === "admin" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
    }`}>
      {role}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
      active ? "text-green-600" : "text-red-500"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500" : "bg-red-400"}`} />
      {active ? "Active" : "Blocked"}
    </span>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span className={`text-xs ${verified ? "text-green-600" : "text-amber-500"}`}>
      {verified ? "Verified" : "Unverified"}
    </span>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const patchMutation = usePatchAdminUser();
  const deleteMutation = useDeleteAdminUser();
  const verifyMutation = useForceVerifyUser();
  const { addNotification } = useUIStore();

  async function toggleActive() {
    try {
      await patchMutation.mutateAsync({ id: user.id, body: { is_active: !user.is_active } });
      addNotification("success", `User ${user.is_active ? "blocked" : "activated"}`);
    } catch (err) {
      addNotification("error", err instanceof Error ? err.message : "Failed");
    }
  }

  async function toggleRole() {
    const newRole = user.role === "admin" ? "user" : "admin";
    try {
      await patchMutation.mutateAsync({ id: user.id, body: { role: newRole } });
      addNotification("success", `Role changed to ${newRole}`);
    } catch (err) {
      addNotification("error", err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleForceVerify() {
    try {
      await verifyMutation.mutateAsync(user.id);
      addNotification("success", "Email verified");
    } catch {
      addNotification("error", "Failed to verify");
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete user ${user.email}? This will remove all their data.`)) return;
    try {
      await deleteMutation.mutateAsync(user.id);
      addNotification("success", "User deleted");
    } catch (err) {
      addNotification("error", err instanceof Error ? err.message : "Failed");
    }
  }

  const busy = patchMutation.isPending || deleteMutation.isPending || verifyMutation.isPending;

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-900">{user.email}</td>
      <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
      <td className="px-4 py-3"><StatusBadge active={user.is_active} /></td>
      <td className="px-4 py-3"><VerifiedBadge verified={user.email_verified} /></td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {new Date(user.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleActive}
            disabled={busy}
            className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            {user.is_active ? "Block" : "Activate"}
          </button>
          <button
            onClick={toggleRole}
            disabled={busy}
            className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            {user.role === "admin" ? "→ User" : "→ Admin"}
          </button>
          {!user.email_verified && (
            <button
              onClick={handleForceVerify}
              disabled={busy}
              className="px-2 py-1 text-xs rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-40"
            >
              Verify
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={busy}
            className="px-2 py-1 text-xs rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const { data, isLoading, isError } = useAdminUsers();
  const { notifications } = useUIStore();

  return (
    <div className="h-full flex flex-col">
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 space-y-2 z-50">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`px-4 py-3 rounded-xl text-sm shadow-lg border ${
                n.type === "success"
                  ? "bg-white border-green-200 text-green-700"
                  : "bg-white border-red-200 text-red-700"
              }`}
            >
              {n.message}
            </div>
          ))}
        </div>
      )}

      <div className="px-8 py-6 border-b border-gray-100 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">Users</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {data?.total ?? 0} user{(data?.total ?? 0) !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-red-500 text-center py-16">Failed to load users</p>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((user) => <UserRow key={user.id} user={user} />)}
              </tbody>
            </table>
            {data?.items.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-12">No users found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
