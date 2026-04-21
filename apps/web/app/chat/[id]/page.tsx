"use client";

import { useParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useChat, useSendMessage } from "@/lib/queries/chats";
import type { Message, Citation } from "@/lib/api";

// ── Language selector ─────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: "auto", label: "Auto" },
  { code: "ru",   label: "Русский" },
  { code: "en",   label: "English" },
  { code: "uk",   label: "Українська" },
  { code: "de",   label: "Deutsch" },
  { code: "fr",   label: "Français" },
  { code: "es",   label: "Español" },
];

function LanguageSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs text-gray-500 bg-transparent border-none outline-none cursor-pointer hover:text-gray-700"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Citation card ─────────────────────────────────────────────────────────────

function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 text-xs overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-600 font-semibold flex items-center justify-center text-xs shrink-0">
            {index}
          </span>
          <span className="font-medium text-gray-700 truncate">{citation.document_title}</span>
          <span className="text-gray-400 shrink-0">· {Math.round(citation.score * 100)}%</span>
        </div>
        <span className="text-gray-400 ml-2 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100">
          <p className="text-gray-500 leading-relaxed line-clamp-6">{citation.text}</p>
        </div>
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold ${
        isUser ? "bg-indigo-500 text-white" : "bg-gray-200 text-gray-600"
      }`}>
        {isUser ? "U" : "AI"}
      </div>

      {/* Content */}
      <div className={`max-w-[75%] space-y-2 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-indigo-500 text-white rounded-tr-sm"
            : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
        }`}>
          {message.content}
        </div>

        {/* Citations */}
        {!isUser && message.citations.length > 0 && (
          <div className="w-full space-y-1">
            {message.citations.map((c, i) => (
              <CitationCard key={c.chunk_id} citation={c} index={i + 1} />
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 px-1">
          {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

// ── Chat input ────────────────────────────────────────────────────────────────

function ChatInput({ onSend, disabled }: { onSend: (q: string) => void; disabled: boolean }) {
  const [text, setText] = useState("");

  function submit() {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="flex items-end gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
        rows={2}
        disabled={disabled}
        className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 disabled:opacity-50 shadow-sm transition-shadow"
      />
      <button
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="w-10 h-10 flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white rounded-xl transition-colors shadow-sm shrink-0"
      >
        {disabled ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const { data: chat, isLoading, isError } = useChat(id);
  const sendMutation = useSendMessage(id);
  const [language, setLanguage] = useState("auto");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("preferred_language");
    if (stored) setLanguage(stored);
  }, []);

  function handleLanguageChange(lang: string) {
    setLanguage(lang);
    localStorage.setItem("preferred_language", lang);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !chat) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-400 text-sm">Chat not found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center justify-between shrink-0">
        <h1 className="text-sm font-semibold text-gray-900 truncate">
          {chat.title ?? "Untitled chat"}
        </h1>
        <LanguageSelector value={language} onChange={handleLanguageChange} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin">
        {chat.messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <p className="text-gray-400 font-medium">No messages yet</p>
              <p className="text-gray-400 text-sm mt-1">Ask anything about your documents</p>
            </div>
          </div>
        ) : (
          chat.messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {sendMutation.isPending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
              AI
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 bg-white border-t border-gray-100 shrink-0">
        <ChatInput
          onSend={(query) => sendMutation.mutate({ query, language })}
          disabled={sendMutation.isPending}
        />
        {sendMutation.isError && (
          <p className="text-red-400 text-xs mt-2">
            {sendMutation.error instanceof Error ? sendMutation.error.message : "Failed to send"}
          </p>
        )}
      </div>
    </div>
  );
}
