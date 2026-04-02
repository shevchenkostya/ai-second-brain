import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DocumentsPage from "@/app/documents/page";

// Мокаем API-модуль — тесты не делают реальных HTTP-запросов
vi.mock("@/lib/api", () => ({
  fetchDocuments: vi.fn(),
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
}));

import { fetchDocuments, uploadDocument, deleteDocument } from "@/lib/api";

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

const mockDocuments = [
  {
    id: "abc-123",
    workspace_id: "ws-1",
    title: "architecture.md",
    source_type: "md",
    mime_type: "text/plain",
    status: "indexed" as const,
    created_at: "2026-04-01T10:00:00Z",
    updated_at: "2026-04-01T10:00:00Z",
  },
  {
    id: "def-456",
    workspace_id: "ws-1",
    title: "PRD.pdf",
    source_type: "pdf",
    mime_type: "application/pdf",
    status: "processing" as const,
    created_at: "2026-04-01T11:00:00Z",
    updated_at: "2026-04-01T11:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DocumentsPage", () => {
  it("показывает список документов", async () => {
    vi.mocked(fetchDocuments).mockResolvedValue({ items: mockDocuments, total: 2 });

    renderWithQuery(<DocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("architecture.md")).toBeInTheDocument();
      expect(screen.getByText("PRD.pdf")).toBeInTheDocument();
    });
  });

  it("показывает счётчик документов", async () => {
    vi.mocked(fetchDocuments).mockResolvedValue({ items: mockDocuments, total: 2 });

    renderWithQuery(<DocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("2 documents")).toBeInTheDocument();
    });
  });

  it("показывает пустое состояние когда документов нет", async () => {
    vi.mocked(fetchDocuments).mockResolvedValue({ items: [], total: 0 });

    renderWithQuery(<DocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("No documents yet")).toBeInTheDocument();
    });
  });

  it("показывает статус каждого документа", async () => {
    vi.mocked(fetchDocuments).mockResolvedValue({ items: mockDocuments, total: 2 });

    renderWithQuery(<DocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("indexed")).toBeInTheDocument();
      expect(screen.getByText("processing")).toBeInTheDocument();
    });
  });

  it("показывает ошибку если загрузка упала", async () => {
    vi.mocked(fetchDocuments).mockRejectedValue(new Error("Network error"));

    renderWithQuery(<DocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load documents")).toBeInTheDocument();
    });
  });

  it("загружает файл и обновляет список", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDocuments).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(uploadDocument).mockResolvedValue(mockDocuments[0]);

    renderWithQuery(<DocumentsPage />);

    await waitFor(() => screen.getByText("Upload document"));

    const file = new File(["# Hello"], "test.md", { type: "text/plain" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(uploadDocument).toHaveBeenCalledWith(file);
  });

  it("вызывает deleteDocument при нажатии delete", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchDocuments).mockResolvedValue({ items: [mockDocuments[0]], total: 1 });
    vi.mocked(deleteDocument).mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithQuery(<DocumentsPage />);

    await waitFor(() => screen.getByText("architecture.md"));

    await user.click(screen.getByRole("button", { name: "delete" }));

    expect(deleteDocument).toHaveBeenCalledWith("abc-123");
  });
});
