"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useArtifact, useDeleteArtifact } from "@/lib/queries/artifacts";
import type { AnalysisMode } from "@/lib/api";

const MODE_LABELS: Record<AnalysisMode, string> = {
  summarize: "Summary",
  compare: "Comparison",
  extract_decisions: "Decision Extraction",
  find_contradictions: "Contradiction Analysis",
  adr: "Architecture Decision Record",
  tech_radar: "Tech Radar",
  risk_analysis: "Risk Analysis",
  system_design: "System Design",
  code_review: "Code Review",
  doc_review: "Document Review",
  pr_summary: "PR Summary",
};

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let orderedBuffer: string[] = [];
  let key = 0;

  function flushList() {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-1 my-3 text-gray-700 text-sm">
          {listBuffer.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
          ))}
        </ul>
      );
      listBuffer = [];
    }
    if (orderedBuffer.length > 0) {
      elements.push(
        <ol key={key++} className="list-decimal list-inside space-y-1 my-3 text-gray-700 text-sm">
          {orderedBuffer.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
          ))}
        </ol>
      );
      orderedBuffer = [];
    }
  }

  function inlineMarkdown(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>');
  }

  for (const line of lines) {
    if (/^### /.test(line)) {
      flushList();
      elements.push(<h3 key={key++} className="text-sm font-semibold text-gray-900 mt-5 mb-1.5">{line.slice(4)}</h3>);
    } else if (/^## /.test(line)) {
      flushList();
      elements.push(<h2 key={key++} className="text-base font-semibold text-gray-900 mt-6 mb-2 border-b border-gray-100 pb-1">{line.slice(3)}</h2>);
    } else if (/^# /.test(line)) {
      flushList();
      elements.push(<h1 key={key++} className="text-lg font-bold text-gray-900 mt-4 mb-3">{line.slice(2)}</h1>);
    } else if (/^---/.test(line)) {
      flushList();
      elements.push(<hr key={key++} className="my-4 border-gray-200" />);
    } else if (/^> /.test(line)) {
      flushList();
      elements.push(
        <blockquote key={key++} className="border-l-4 border-indigo-200 pl-4 py-0.5 my-2 text-sm text-gray-600 italic">
          {line.slice(2)}
        </blockquote>
      );
    } else if (/^[\-\*] /.test(line)) {
      if (orderedBuffer.length) flushList();
      listBuffer.push(line.slice(2));
    } else if (/^\d+\. /.test(line)) {
      if (listBuffer.length) flushList();
      orderedBuffer.push(line.replace(/^\d+\. /, ""));
    } else if (line.trim() === "") {
      flushList();
      elements.push(<div key={key++} className="h-2" />);
    } else {
      flushList();
      elements.push(
        <p key={key++} className="text-sm text-gray-700 leading-relaxed my-1" dangerouslySetInnerHTML={{ __html: inlineMarkdown(line) }} />
      );
    }
  }
  flushList();

  return <div className="prose-sm max-w-none">{elements}</div>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ArtifactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: artifact, isLoading, isError } = useArtifact(id);
  const deleteMutation = useDeleteArtifact();

  async function handleDelete() {
    if (!confirm("Delete this artifact?")) return;
    await deleteMutation.mutateAsync(id);
    router.push("/artifacts");
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-8 w-1/2 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-4 w-1/4 bg-gray-100 rounded animate-pulse" />
          <div className="space-y-2 mt-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !artifact) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-sm">Artifact not found</p>
          <Link href="/artifacts" className="text-indigo-600 text-sm hover:underline mt-2 block">
            Back to artifacts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-8 py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/artifacts"
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Artifacts
              </Link>
              <span className="text-xs text-gray-300">/</span>
              <span className="text-xs text-gray-500">
                {MODE_LABELS[artifact.artifact_type] ?? artifact.artifact_type}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              {artifact.title ?? MODE_LABELS[artifact.artifact_type]}
            </h1>
            <p className="text-xs text-gray-400 mt-1">{formatDate(artifact.created_at)}</p>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-gray-200 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-all shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            Delete
          </button>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
            {MODE_LABELS[artifact.artifact_type] ?? artifact.artifact_type}
          </span>
          <span className="text-xs text-gray-400">
            {artifact.source_refs.length} source document{artifact.source_refs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {artifact.content ? (
            <MarkdownContent content={artifact.content} />
          ) : (
            <p className="text-sm text-gray-400 italic">No content available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
