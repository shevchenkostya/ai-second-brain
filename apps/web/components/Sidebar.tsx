"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useChats, useCreateChat, useDeleteChat } from "@/lib/queries/chats";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: chats = [] } = useChats();
  const createMutation = useCreateChat();
  const deleteMutation = useDeleteChat();

  const isOnDocuments = pathname.startsWith("/documents");

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
      <div className="px-2 py-3 border-t border-white/10">
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
        </Link>
      </div>
    </aside>
  );
}
