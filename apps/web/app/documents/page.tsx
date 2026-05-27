"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDocuments, useUploadDocument, useDeleteDocument } from "@/lib/queries/documents";
import {
  useGoogleDriveStatus,
  useGoogleDriveSources,
  useConnectGoogleDrive,
  useIngestGoogleDriveFile,
} from "@/lib/queries/mcp";
import { useUIStore } from "@/store/ui";
import type { MCPSource } from "@/lib/api";

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  uploaded:   { label: "Uploaded",   dot: "bg-blue-400",   text: "text-blue-600" },
  queued:     { label: "Queued",     dot: "bg-yellow-400", text: "text-yellow-600" },
  processing: { label: "Processing", dot: "bg-orange-400", text: "text-orange-600" },
  indexed:    { label: "Indexed",    dot: "bg-green-400",  text: "text-green-600" },
  failed:     { label: "Failed",     dot: "bg-red-400",    text: "text-red-600" },
};

function FileIcon({ type }: { type: string | null }) {
  const colors: Record<string, string> = {
    pdf: "bg-red-100 text-red-600",
    docx: "bg-blue-100 text-blue-600",
    md: "bg-purple-100 text-purple-600",
    txt: "bg-gray-100 text-gray-600",
    json: "bg-yellow-100 text-yellow-600",
    yaml: "bg-orange-100 text-orange-600",
    html: "bg-green-100 text-green-600",
  };
  const color = colors[type ?? ""] ?? "bg-gray-100 text-gray-500";
  return (
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold uppercase shrink-0 ${color}`}>
      {type ?? "—"}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: "bg-gray-400", text: "text-gray-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "processing" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

// ── Google Drive modal ────────────────────────────────────────────────────────

function GoogleDriveModal({ onClose }: { onClose: () => void }) {
  const { data, isLoading, isError } = useGoogleDriveSources(true);
  const ingestMutation = useIngestGoogleDriveFile();
  const { addNotification } = useUIStore();
  const [ingesting, setIngesting] = useState<Set<string>>(new Set());

  async function handleIngest(source: MCPSource) {
    setIngesting((prev) => new Set(prev).add(source.id));
    try {
      await ingestMutation.mutateAsync(source.id);
      addNotification("success", `"${source.name}" queued for indexing`);
    } catch (err: unknown) {
      addNotification("error", err instanceof Error ? err.message : "Import failed");
    } finally {
      setIngesting((prev) => {
        const next = new Set(prev);
        next.delete(source.id);
        return next;
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.5 2L2 14h5l1.5-3h7L17 14h5L14.5 2h-6z" fill="#4285F4" />
              <path d="M2 14l5 8h10l-5-8H2z" fill="#0F9D58" />
              <path d="M17 14l5-8h-6l-5 8h6z" fill="#FBBC05" />
            </svg>
            <h2 className="text-sm font-semibold text-gray-900">Import from Google Drive</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-red-500 text-center py-8">Failed to load files from Google Drive</p>
          ) : !data?.sources.length ? (
            <p className="text-sm text-gray-400 text-center py-8">No supported files found in your Drive</p>
          ) : (
            <div className="space-y-1.5">
              {data.sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{source.name}</p>
                    {source.modified_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(source.modified_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleIngest(source)}
                    disabled={ingesting.has(source.id)}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {ingesting.has(source.id) ? "Importing…" : "Import"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">Supported: Docs, PDFs, DOCX, TXT, MD and more</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  const { data, isLoading, isError } = useDocuments();
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();
  const { uploading, setUploading, notifications, addNotification } = useUIStore();

  const { data: driveStatus, refetch: refetchStatus } = useGoogleDriveStatus();
  const connectMutation = useConnectGoogleDrive();
  const [showDriveModal, setShowDriveModal] = useState(false);

  // Detect return from Google OAuth callback
  useEffect(() => {
    if (searchParams.get("mcp") === "connected") {
      refetchStatus();
      addNotification("success", "Google Drive connected");
      window.history.replaceState({}, "", "/documents");
    }
  }, [searchParams, refetchStatus, addNotification]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
      addNotification("success", `"${file.name}" uploaded`);
    } catch (err: unknown) {
      addNotification("error", err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      addNotification("success", `"${title}" deleted`);
    } catch {
      addNotification("error", "Failed to delete document");
    }
  }

  function handleDriveClick() {
    if (driveStatus?.connected) {
      setShowDriveModal(true);
    } else {
      connectMutation.mutate();
    }
  }

  const documents = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="h-full flex flex-col">
      {showDriveModal && <GoogleDriveModal onClose={() => setShowDriveModal(false)} />}

      {/* Notifications */}
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

      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-100 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} document{total !== 1 ? "s" : ""} in your knowledge base
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Google Drive import */}
          <button
            onClick={handleDriveClick}
            disabled={connectMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            title={driveStatus?.connected ? "Import from Google Drive" : "Connect Google Drive"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.5 2L2 14h5l1.5-3h7L17 14h5L14.5 2h-6z" fill="#4285F4" />
              <path d="M2 14l5 8h10l-5-8H2z" fill="#0F9D58" />
              <path d="M17 14l5-8h-6l-5 8h6z" fill="#FBBC05" />
            </svg>
            {connectMutation.isPending
              ? "Connecting…"
              : driveStatus?.connected
              ? "Google Drive"
              : "Connect Drive"}
          </button>

          {/* File upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.pdf,.docx,.json,.yaml,.html"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <p className="text-red-500 text-sm">Failed to load documents</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No documents yet</p>
            <p className="text-gray-400 text-sm mt-1">Upload a file or import from Google Drive</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors"
              >
                <FileIcon type={doc.source_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(doc.created_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <StatusBadge status={doc.status} />
                <button
                  onClick={() => handleDelete(doc.id, doc.title)}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
