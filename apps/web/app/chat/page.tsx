"use client";

import { useRouter } from "next/navigation";
import { useCreateChat } from "@/lib/queries/chats";

export default function ChatIndexPage() {
  const router = useRouter();
  const createMutation = useCreateChat();

  async function handleCreate() {
    const chat = await createMutation.mutateAsync(undefined);
    router.push(`/chat/${chat.id}`);
  }

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Start a conversation</h2>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          Ask questions about your indexed documents. Answers are grounded in your knowledge base.
        </p>
        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="mt-6 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {createMutation.isPending ? "Creating..." : "New chat"}
        </button>
      </div>
    </div>
  );
}
