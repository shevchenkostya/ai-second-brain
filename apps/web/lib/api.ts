const API_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:4000";

// ── Token management ──────────────────────────────────────────────────────────

const TOKEN_KEY = "sb_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

// ── Central fetch helper ──────────────────────────────────────────────────────

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
  }

  return res;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function register(email: string, password: string): Promise<{ access_token: string }> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Registration failed");
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<{ access_token: string }> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Invalid email or password");
  }
  return res.json();
}

export function logout(): void {
  clearToken();
  if (typeof window !== "undefined") window.location.href = "/login";
}

export async function getMe(): Promise<{ id: string; email: string }> {
  const res = await apiFetch(`${API_URL}/api/auth/me`);
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

// ── Document types ────────────────────────────────────────────────────────────

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

// ── Document API ──────────────────────────────────────────────────────────────

export async function fetchDocuments(): Promise<DocumentListResponse> {
  const res = await apiFetch(`${API_URL}/api/documents`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function uploadDocument(file: File): Promise<Document> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch(`${API_URL}/api/documents/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/documents/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete document");
}

// ── Chat types ────────────────────────────────────────────────────────────────

export interface Citation {
  chunk_id: string;
  document_id: string;
  document_title: string;
  text: string;
  score: number;
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  created_at: string;
}

export interface Chat {
  id: string;
  workspace_id: string;
  title: string | null;
  created_at: string;
  messages: Message[];
}

// ── Chat API ──────────────────────────────────────────────────────────────────

export async function fetchChats(): Promise<Chat[]> {
  const res = await apiFetch(`${API_URL}/api/chats`);
  if (!res.ok) throw new Error("Failed to fetch chats");
  return res.json();
}

export async function fetchChat(id: string): Promise<Chat> {
  const res = await apiFetch(`${API_URL}/api/chats/${id}`);
  if (!res.ok) throw new Error("Chat not found");
  return res.json();
}

export async function createChat(title?: string): Promise<Chat> {
  const res = await apiFetch(`${API_URL}/api/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title ?? null }),
  });
  if (!res.ok) throw new Error("Failed to create chat");
  return res.json();
}

export async function deleteChat(id: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/chats/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete chat");
}

export async function sendMessage(chatId: string, query: string, language = "auto"): Promise<Message> {
  const res = await apiFetch(`${API_URL}/api/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, language }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to send message");
  }
  return res.json();
}

// ── Artifact types ────────────────────────────────────────────────────────────

export type AnalysisMode =
  | "summarize" | "compare" | "extract_decisions" | "find_contradictions"
  | "adr" | "tech_radar" | "risk_analysis" | "system_design"
  | "code_review" | "doc_review" | "pr_summary";

export interface Artifact {
  id: string;
  artifact_type: AnalysisMode;
  title: string | null;
  content: string | null;
  source_refs: string[];
  created_at: string;
}

export interface AnalyzeRequest {
  mode: AnalysisMode;
  document_ids: string[];
  language?: string;
  title?: string;
}

// ── Artifact API ──────────────────────────────────────────────────────────────

export async function fetchArtifacts(): Promise<Artifact[]> {
  const res = await apiFetch(`${API_URL}/api/artifacts`);
  if (!res.ok) throw new Error("Failed to fetch artifacts");
  return res.json();
}

export async function fetchArtifact(id: string): Promise<Artifact> {
  const res = await apiFetch(`${API_URL}/api/artifacts/${id}`);
  if (!res.ok) throw new Error("Artifact not found");
  return res.json();
}

export async function analyzeDocuments(body: AnalyzeRequest): Promise<Artifact> {
  const res = await apiFetch(`${API_URL}/api/artifacts/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Analysis failed");
  }
  return res.json();
}

export async function deleteArtifact(id: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/artifacts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete artifact");
}
