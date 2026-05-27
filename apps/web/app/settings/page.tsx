"use client";

import { useState } from "react";
import { changePassword, resendVerification, getMe } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function SettingsPage() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match");
      return;
    }
    setPwLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      setPwSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPwLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    await resendVerification().catch(() => {});
    setResendDone(true);
    setResendLoading(false);
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-8 max-w-xl">
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Settings</h1>

      {/* Account info */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Account</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-900">{me?.email}</p>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">{me?.role}</p>
          </div>
          {me && !me.email_verified && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">Email not verified</span>
              <button
                onClick={handleResend}
                disabled={resendLoading || resendDone}
                className="text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
              >
                {resendDone ? "Sent!" : resendLoading ? "Sending…" : "Resend"}
              </button>
            </div>
          )}
          {me?.email_verified && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">Verified</span>
          )}
        </div>
      </section>

      {/* Change password */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Change password</h2>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
          {pwError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              Password changed successfully
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Current password</label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="••••••••"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">New password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Min 8 characters"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Confirm new password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={pwLoading}
            className="mt-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 self-start"
          >
            {pwLoading ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>
    </div>
  );
}
