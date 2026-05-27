"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChats, useCreateChat, useDeleteChat } from "@/lib/queries/chats";
import { useDocuments } from "@/lib/queries/documents";
import { getMe, logout, getToken, type MeResponse } from "@/lib/api";

const PUBLIC_PATHS = ["/login", "/register"];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: chats = [] } = useChats();
  const { data: docResponse } = useDocuments();
  const createMutation = useCreateChat();
  const deleteMutation = useDeleteChat();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) return;
    if (!getToken()) return;
    getMe()
      .then((u) => setMe(u))
      .catch(() => setMe(null));
  }, [pathname]);

  if (PUBLIC_PATHS.includes(pathname)) return null;

  const isOnDocuments = pathname.startsWith("/documents");
  const isOnArtifacts = pathname.startsWith("/artifacts");
  const isOnSettings = pathname.startsWith("/settings");
  const isOnAdmin = pathname.startsWith("/admin");

  const activeJobs = (docResponse?.items ?? []).filter(
    (d) => d.status === "queued" || d.status === "processing"
  ).length;

  async function handleNewChat() {
    const chat = await createMutation.mutateAsync(undefined);
    router.push(`/chat/${chat.id}`);
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this chat?")) return;
    deleteMutation.mutate(id);
    if (pathname === `/chat/${id}`) router.push("/chat");
  }

  function handleLogout() {
    queryClient.clear();
    logout();
  }

  return (
    <aside className="w-64 shrink-0 h-full flex flex-col bg-gray-900">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            AI
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">
            Second Brain
          </span>
        </Link>
      </div>

      {/* New chat */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={handleNewChat}
          disabled={createMutation.isPending}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {createMutation.isPending ? "Creating..." : "New chat"}
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin">
        {chats.length > 0 && (
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Recent
          </p>
        )}
        {chats.map((chat) => {
          const isActive = pathname === `/chat/${chat.id}`;
          return (
            <Link
              key={chat.id}
              href={`/chat/${chat.id}`}
              className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm my-0.5 transition-colors ${
                isActive
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="truncate">{chat.title ?? "Untitled chat"}</span>
              </div>
              <button
                onClick={(e) => handleDelete(e, chat.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:text-red-400 shrink-0"
                title="Delete"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
            </Link>
          );
        })}
      </div>

      {/* Bottom nav */}
      <div className="px-2 py-3 border-t border-white/10 flex flex-col gap-0.5">
        <Link
          href="/documents"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            isOnDocuments
              ? "bg-gray-700 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Documents
          {activeJobs > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {activeJobs}
            </span>
          )}
        </Link>
        <Link
          href="/artifacts"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            isOnArtifacts
              ? "bg-gray-700 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Artifacts
        </Link>

        <Link
          href="/settings"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            isOnSettings
              ? "bg-gray-700 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </Link>

        {me?.role === "admin" && (
          <Link
            href="/admin/users"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              isOnAdmin
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Users
          </Link>
        )}

        {/* User info + logout */}
        <div className="mt-2 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-gray-500 truncate max-w-[140px]" title={me?.email ?? ""}>
              {me?.email ?? ""}
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-400 transition-colors shrink-0 ml-2"
              title="Sign out"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
