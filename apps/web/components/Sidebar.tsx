"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useChats, useCreateChat, useDeleteChat } from "@/lib/queries/chats";

function IconChat() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconDocs() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

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
    <aside
      className="fixed left-0 top-0 h-full flex flex-col z-20"
      style={{ width: "var(--sidebar-width)", background: "var(--sidebar-bg)" }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
            AI
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">
            Second Brain
          </span>
        </Link>
      </div>

      {/* New chat button */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={handleNewChat}
          disabled={createMutation.isPending}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={{ color: "var(--sidebar-text)", background: "var(--sidebar-hover)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--sidebar-active)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--sidebar-hover)")}
        >
          <IconPlus />
          {createMutation.isPending ? "Creating..." : "New chat"}
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 scrollbar-thin">
        {chats.length > 0 && (
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--sidebar-text-muted)" }}>
            Recent
          </p>
        )}
        {chats.map((chat) => {
          const isActive = pathname === `/chat/${chat.id}`;
          return (
            <Link
              key={chat.id}
              href={`/chat/${chat.id}`}
              className="group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm my-0.5 transition-colors"
              style={{
                color: isActive ? "#fff" : "var(--sidebar-text)",
                background: isActive ? "var(--sidebar-active)" : "transparent",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--sidebar-hover)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span style={{ color: "var(--sidebar-text-muted)", flexShrink: 0 }}>
                  <IconChat />
                </span>
                <span className="truncate">{chat.title ?? "Untitled chat"}</span>
              </div>
              <button
                onClick={(e) => handleDelete(e, chat.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-red-400 shrink-0"
                style={{ color: "var(--sidebar-text-muted)" }}
              >
                <IconTrash />
              </button>
            </Link>
          );
        })}
      </div>

      {/* Bottom nav */}
      <div className="px-2 py-3 border-t border-white/10 space-y-0.5">
        <Link
          href="/documents"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
          style={{
            color: isOnDocuments ? "#fff" : "var(--sidebar-text)",
            background: isOnDocuments ? "var(--sidebar-active)" : "transparent",
          }}
          onMouseEnter={e => { if (!isOnDocuments) e.currentTarget.style.background = "var(--sidebar-hover)"; }}
          onMouseLeave={e => { if (!isOnDocuments) e.currentTarget.style.background = "transparent"; }}
        >
          <IconDocs />
          Documents
        </Link>
      </div>
    </aside>
  );
}
