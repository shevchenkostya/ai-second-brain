const API_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:4000";

// ── Token management ──────────────────────────────────────────────────────────

const ACCESS_TOKEN_KEY = "sb_token";
const REFRESH_TOKEN_KEY = "sb_refresh_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setToken(access: string, refresh: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

// ── Auto-refresh logic ────────────────────────────────────────────────────────

let _refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setToken(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

// ── Central fetch helper ──────────────────────────────────────────────────────

async function apiFetch(url: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiFetch(url, options, false);
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
  }

  return res;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface MeResponse {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
}

export async function register(email: string, password: string): Promise<TokenResponse> {
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

export async function login(email: string, password: string): Promise<TokenResponse> {
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

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await apiFetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => {});
  }
  clearToken();
  if (typeof window !== "undefined") window.location.href = "/login";
}

export async function getMe(): Promise<MeResponse> {
  const res = await apiFetch(`${API_URL}/api/auth/me`);
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

export async function verifyEmail(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Verification failed");
  }
}

export async function resendVerification(): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/auth/resend-verification`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to resend verification");
}

export async function forgotPassword(email: string): Promise<void> {
  await fetch(`${API_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, new_password: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Reset failed");
  }
}

export async function changePassword(old_password: string, new_password: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_password, new_password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Password change failed");
  }
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

// ── MCP types ─────────────────────────────────────────────────────────────────

export interface MCPSource {
  id: string;
  name: string;
  mime_type: string;
  modified_at: string | null;
}

// ── MCP API ───────────────────────────────────────────────────────────────────

export async function fetchGoogleDriveStatus(): Promise<{ connected: boolean }> {
  const res = await apiFetch(`${API_URL}/api/mcp/google/status`);
  if (!res.ok) throw new Error("Failed to check Google Drive status");
  return res.json();
}

export async function fetchGoogleAuthUrl(): Promise<{ auth_url: string }> {
  const res = await apiFetch(`${API_URL}/api/mcp/google/auth`);
  if (!res.ok) throw new Error("Failed to get Google auth URL");
  return res.json();
}

export async function fetchGoogleDriveSources(): Promise<{ sources: MCPSource[] }> {
  const res = await apiFetch(`${API_URL}/api/mcp/google/sources`);
  if (!res.ok) throw new Error("Failed to list Google Drive files");
  return res.json();
}

export async function ingestGoogleDriveFile(file_id: string): Promise<{ document_id: string; title: string; status: string }> {
  const res = await apiFetch(`${API_URL}/api/mcp/google/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Ingest failed");
  }
  return res.json();
}

// ── Admin types ───────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

export interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
}

// ── Admin API ─────────────────────────────────────────────────────────────────

export async function fetchAdminUsers(offset = 0, limit = 50): Promise<AdminUserListResponse> {
  const res = await apiFetch(`${API_URL}/api/admin/users?offset=${offset}&limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function patchAdminUser(id: string, body: { role?: string; is_active?: boolean }): Promise<AdminUser> {
  const res = await apiFetch(`${API_URL}/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Update failed");
  }
  return res.json();
}

export async function deleteAdminUser(id: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/api/admin/users/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete user");
}

export async function forceVerifyUser(id: string): Promise<AdminUser> {
  const res = await apiFetch(`${API_URL}/api/admin/users/${id}/force-verify`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to verify user");
  return res.json();
}
