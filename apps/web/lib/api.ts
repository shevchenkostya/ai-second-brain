const API_URL = process.env.API_URL ?? "http://localhost:4000";

export interface Document {
  id: string;
  workspace_id: string;
  title: string;
  source_type: string | null;
  mime_type: string | null;
  status: "uploaded" | "queued" | "processing" | "indexed" | "failed";
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  items: Document[];
  total: number;
}

export async function fetchDocuments(): Promise<DocumentListResponse> {
  const res = await fetch(`${API_URL}/api/documents`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function uploadDocument(file: File): Promise<Document> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/documents/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete document");
}
