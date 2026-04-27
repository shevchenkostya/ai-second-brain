"use client";

import { useState } from "react";
import Link from "next/link";
import { useArtifacts, useAnalyze, useDeleteArtifact } from "@/lib/queries/artifacts";
import { useQuery } from "@tanstack/react-query";
import { fetchDocuments } from "@/lib/api";
import type { AnalysisMode } from "@/lib/api";

const MODES: { value: AnalysisMode; label: string; description: string }[] = [
  { value: "summarize", label: "Summarize", description: "Structured summary of key concepts" },
  { value: "compare", label: "Compare", description: "Side-by-side comparison of documents" },
  { value: "extract_decisions", label: "Extract Decisions", description: "Action items, decisions, commitments" },
  { value: "find_contradictions", label: "Find Contradictions", description: "Conflicts and inconsistencies" },
];

const LANGUAGES = [
  { value: "auto", label: "Auto" },
  { value: "en", label: "English" },
  { value: "ru", label: "Russian" },
  { value: "uk", label: "Ukrainian" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
];

function ModeIcon({ mode }: { mode: AnalysisMode }) {
  const icons: Record<AnalysisMode, React.ReactNode> = {
    summarize: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
    compare: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 21 18 18 21" /><polyline points="6 9 3 6 6 3" />
        <line x1="3" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="21" y2="6" />
      </svg>
    ),
    extract_decisions: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    find_contradictions: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  };
  return <>{icons[mode]}</>;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ArtifactsPage() {
  const { data: artifacts = [], isLoading: artifactsLoading } = useArtifacts();
  const { data: docResponse } = useQuery({
    queryKey: ["documents"],
    queryFn: fetchDocuments,
  });
  const documents = docResponse?.items ?? [];
  const indexedDocs = documents.filter((d) => d.status === "indexed");

  const analyzeMutation = useAnalyze();
  const deleteMutation = useDeleteArtifact();

  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [mode, setMode] = useState<AnalysisMode>("summarize");
  const [language, setLanguage] = useState("auto");
  const [customTitle, setCustomTitle] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  function toggleDoc(id: string) {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  async function handleAnalyze() {
    if (selectedDocs.length === 0) return;
    const artifact = await analyzeMutation.mutateAsync({
      mode,
      document_ids: selectedDocs,
      language,
      title: customTitle.trim() || undefined,
    });
    setSelectedDocs([]);
    setCustomTitle("");
    setFormOpen(false);
    window.location.href = `/artifacts/${artifact.id}`;
  }

  return (
    <div className="flex h-full">
      {/* Main list */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Artifacts</h1>
            <p className="text-sm text-gray-500 mt-0.5">AI-generated analyses of your documents</p>
          </div>
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New analysis
          </button>
        </div>

        <div className="flex-1 px-6 py-4">
          {artifactsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : artifacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">No artifacts yet</p>
              <p className="text-sm text-gray-400 mt-1">Run an analysis on your indexed documents</p>
            </div>
          ) : (
            <div className="space-y-2">
              {artifacts.map((artifact) => (
                <Link
                  key={artifact.id}
                  href={`/artifacts/${artifact.id}`}
                  className="group flex items-start gap-4 p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <ModeIcon mode={artifact.artifact_type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {artifact.title ?? artifact.artifact_type}
                      </p>
                      <span className="text-xs text-gray-400 shrink-0">{timeAgo(artifact.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {artifact.source_refs.length} source{artifact.source_refs.length !== 1 ? "s" : ""}
                    </p>
                    {artifact.content && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                        {artifact.content.replace(/[#*>`\[\]]/g, "").slice(0, 120)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm("Delete this artifact?")) deleteMutation.mutate(artifact.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 text-gray-400 shrink-0"
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Analysis form panel */}
      {formOpen && (
        <div className="w-80 shrink-0 border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">New analysis</h2>
            <button
              onClick={() => setFormOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Mode */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Analysis type</label>
              <div className="space-y-1.5">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                      mode === m.value
                        ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <span className={`mt-0.5 ${mode === m.value ? "text-indigo-600" : "text-gray-400"}`}>
                      <ModeIcon mode={m.value} />
                    </span>
                    <div>
                      <p className="text-xs font-medium">{m.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{m.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Documents */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Documents{" "}
                <span className="font-normal text-gray-400">
                  ({selectedDocs.length} selected)
                </span>
              </label>
              {indexedDocs.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No indexed documents. Upload and index documents first.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {indexedDocs.map((doc) => {
                    const checked = selectedDocs.includes(doc.id);
                    return (
                      <label
                        key={doc.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                          checked
                            ? "border-indigo-300 bg-indigo-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDoc(doc.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-gray-700 truncate">{doc.title}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Custom title */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Title <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Auto-generated if empty"
                className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div className="px-5 py-4 border-t border-gray-200">
            <button
              onClick={handleAnalyze}
              disabled={selectedDocs.length === 0 || analyzeMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {analyzeMutation.isPending ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Run analysis"
              )}
            </button>
            {analyzeMutation.isError && (
              <p className="text-xs text-red-500 mt-2 text-center">
                {(analyzeMutation.error as Error).message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
