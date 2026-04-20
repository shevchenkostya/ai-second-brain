"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useChat, useSendMessage } from "@/lib/queries/chats";
import type { Message, Citation } from "@/lib/api";

// ── Citation card ─────────────────────────────────────────────────────────────

function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-md text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50"
      >
        <span className="font-medium text-gray-700">
          [{index}] {citation.document_title}
        </span>
        <span className="text-gray-400 ml-2">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-gray-600 border-t border-gray-100 pt-2">
          <p className="italic">{citation.text}</p>
          <p className="mt-1 text-gray-400">score: {citation.score}</p>
        </div>
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] ${isUser ? "order-2" : ""}`}>
        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
            isUser
              ? "bg-gray-900 text-white rounded-br-sm"
              : "bg-white border border-gray-200 text-gray-900 rounded-bl-sm"
          }`}
        >
          {message.content}
        </div>

        {/* Citations */}
        {!isUser && message.citations.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.citations.map((c, i) => (
              <CitationCard key={c.chunk_id} citation={c} index={i + 1} />
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-1 px-1">
          {new Date(message.created_at).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

// ── Chat input ────────────────────────────────────────────────────────────────

function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (query: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question about your documents… (Enter to send)"
        rows={2}
        disabled={disabled}
        className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="px-4 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
      >
        {disabled ? "..." : "Send"}
      </button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const { data: chat, isLoading, isError } = useChat(id);
  const sendMutation = useSendMessage(id);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  async function handleSend(query: string) {
    await sendMutation.mutateAsync(query);
  }

  if (isLoading) return <div className="p-10 text-gray-400 text-sm">Loading chat...</div>;
  if (isError || !chat) return <div className="p-10 text-red-500 text-sm">Chat not found</div>;

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center gap-3 py-4 border-b border-gray-200 shrink-0">
        <Link href="/chat" className="text-gray-400 hover:text-gray-700 text-sm">
          ← Chats
        </Link>
        <h1 className="text-sm font-semibold text-gray-900 truncate">
          {chat.title ?? "Untitled chat"}
        </h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {chat.messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-base">Ask anything about your documents</p>
            <p className="text-sm mt-1">Answers are grounded in what you have indexed</p>
          </div>
        ) : (
          chat.messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {/* Typing indicator */}
        {sendMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-400">
              Thinking...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="py-4 border-t border-gray-200 shrink-0">
        <ChatInput onSend={handleSend} disabled={sendMutation.isPending} />
        {sendMutation.isError && (
          <p className="text-red-500 text-xs mt-2">
            {sendMutation.error instanceof Error
              ? sendMutation.error.message
              : "Failed to send message"}
          </p>
        )}
      </div>
    </div>
  );
}
