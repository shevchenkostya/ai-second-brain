"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useChats, useCreateChat, useDeleteChat } from "@/lib/queries/chats";

export default function ChatsPage() {
  const router = useRouter();
  const { data: chats = [], isLoading, isError } = useChats();
  const createMutation = useCreateChat();
  const deleteMutation = useDeleteChat();

  async function handleCreate() {
    const chat = await createMutation.mutateAsync(undefined);
    router.push(`/chat/${chat.id}`);
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    if (!confirm("Delete this chat?")) return;
    await deleteMutation.mutateAsync(id);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chats</h1>
          <p className="text-sm text-gray-500 mt-1">Ask questions about your documents</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {createMutation.isPending ? "Creating..." : "New chat"}
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : isError ? (
        <p className="text-red-500 text-sm">Failed to load chats</p>
      ) : chats.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No chats yet</p>
          <p className="text-sm mt-1">Start a new chat to ask questions about your documents</p>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/chat/${chat.id}`}
              className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {chat.title ?? "Untitled chat"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(chat.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={(e) => handleDelete(e, chat.id)}
                disabled={deleteMutation.isPending}
                className="ml-4 text-gray-300 hover:text-red-500 text-xs transition-colors shrink-0"
              >
                delete
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
