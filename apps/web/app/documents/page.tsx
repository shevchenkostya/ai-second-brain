"use client";

import { useRef } from "react";
import { useDocuments, useUploadDocument, useDeleteDocument } from "@/lib/queries/documents";
import { useUIStore } from "@/store/ui";

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-blue-100 text-blue-700",
  queued: "bg-yellow-100 text-yellow-700",
  processing: "bg-orange-100 text-orange-700",
  indexed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function DocumentsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = useDocuments();
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  const { uploading, setUploading, notifications, addNotification } = useUIStore();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
      addNotification("success", `"${file.name}" uploaded successfully`);
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

  const documents = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 space-y-2 z-50">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`px-4 py-3 rounded-lg text-sm shadow-md ${
                n.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {n.message}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} document{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div>
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
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload document"}
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : isError ? (
        <p className="text-red-500 text-sm">Failed to load documents</p>
      ) : documents.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No documents yet</p>
          <p className="text-sm mt-1">Upload a markdown, PDF, or text file to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-gray-400 text-sm uppercase font-mono w-10 shrink-0">
                  {doc.source_type ?? "—"}
                </span>
                <span className="text-gray-900 text-sm font-medium truncate">{doc.title}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[doc.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {doc.status}
                </span>
                <span className="text-gray-400 text-xs">
                  {new Date(doc.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() => handleDelete(doc.id, doc.title)}
                  disabled={deleteMutation.isPending}
                  className="text-gray-300 hover:text-red-500 text-xs transition-colors disabled:opacity-50"
                >
                  delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
