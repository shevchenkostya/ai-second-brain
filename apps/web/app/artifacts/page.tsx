"use client";

import { useState } from "react";
import Link from "next/link";
import { useArtifacts, useAnalyze, useDeleteArtifact } from "@/lib/queries/artifacts";
import { useQuery } from "@tanstack/react-query";
import { fetchDocuments } from "@/lib/api";
import type { AnalysisMode } from "@/lib/api";

type ModeGroup = {
  group: string;
  color: "indigo" | "violet" | "emerald";
  items: { value: AnalysisMode; label: string; description: string }[];
};

const MODE_GROUPS: ModeGroup[] = [
  {
    group: "Analyst",
    color: "indigo",
    items: [
      { value: "summarize", label: "Summarize", description: "Structured summary of key concepts" },
      { value: "compare", label: "Compare", description: "Side-by-side comparison of documents" },
      { value: "extract_decisions", label: "Extract Decisions", description: "Action items and commitments" },
      { value: "find_contradictions", label: "Find Contradictions", description: "Conflicts and inconsistencies" },
    ],
  },
  {
    group: "Architect",
    color: "violet",
    items: [
      { value: "adr", label: "ADR", description: "Architecture Decision Record" },
      { value: "tech_radar", label: "Tech Radar", description: "Technology assessment by quadrant" },
      { value: "risk_analysis", label: "Risk Analysis", description: "Critical, high, medium, low risks" },
      { value: "system_design", label: "System Design", description: "Components, data flow, and boundaries" },
    ],
  },
  {
    group: "Reviewer",
    color: "emerald",
    items: [
      { value: "code_review", label: "Code Review", description: "Bugs, issues, and improvement suggestions" },
      { value: "doc_review", label: "Doc Review", description: "Clarity, completeness, audience fit" },
      { value: "pr_summary", label: "PR Summary", description: "What changed, why, and how to test" },
    ],
  },
];

const ARCHITECT_MODES = new Set<AnalysisMode>(["adr", "tech_radar", "risk_analysis", "system_design"]);
const REVIEWER_MODES = new Set<AnalysisMode>(["code_review", "doc_review", "pr_summary"]);

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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
    compare: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 21 18 18 21" /><polyline points="6 9 3 6 6 3" />
        <line x1="3" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="21" y2="6" />
      </svg>
    ),
    extract_decisions: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    find_contradictions: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    adr: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    tech_radar: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="2" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="10" />
        <line x1="12" y1="2" x2="12" y2="4" />
      </svg>
    ),
    risk_analysis: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    system_design: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="6" height="4" rx="1" /><rect x="9" y="3" width="6" height="4" rx="1" /><rect x="16" y="3" width="6" height="4" rx="1" />
        <rect x="5" y="14" width="6" height="4" rx="1" /><rect x="13" y="14" width="6" height="4" rx="1" />
        <line x1="5" y1="7" x2="5" y2="10" /><line x1="12" y1="7" x2="12" y2="14" /><line x1="19" y1="7" x2="19" y2="10" />
        <line x1="5" y1="10" x2="19" y2="10" /><line x1="8" y1="18" x2="13" y2="18" />
      </svg>
    ),
    code_review: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    doc_review: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    pr_summary: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" />
        <path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" />
      </svg>
    ),
  };
  return <>{icons[mode] ?? null}</>;
}

function modeBadgeColor(mode: AnalysisMode) {
  if (ARCHITECT_MODES.has(mode)) return "bg-violet-100 text-violet-600";
  if (REVIEWER_MODES.has(mode)) return "bg-emerald-100 text-emerald-600";
  return "bg-indigo-100 text-indigo-600";
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
  const { data: docResponse } = useQuery({ queryKey: ["documents"], queryFn: fetchDocuments });
  const indexedDocs = (docResponse?.items ?? []).filter((d) => d.status === "indexed");

  const analyzeMutation = useAnalyze();
  const deleteMutation = useDeleteArtifact();

  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [mode, setMode] = useState<AnalysisMode>("summarize");
  const [language, setLanguage] = useState("auto");
  const [customTitle, setCustomTitle] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  function toggleDoc(id: string) {
    setSelectedDocs((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
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
            <p className="text-sm text-gray-500 mt-0.5">AI-generated analyses and architecture docs</p>
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
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${modeBadgeColor(artifact.artifact_type)}`}>
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
            <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Mode groups */}
            {MODE_GROUPS.map((group) => (
              <div key={group.group}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                  group.color === "violet" ? "text-violet-500"
                  : group.color === "emerald" ? "text-emerald-500"
                  : "text-indigo-500"
                }`}>
                  {group.group}
                </p>
                <div className="space-y-1.5">
                  {group.items.map((m) => {
                    const active = mode === m.value;
                    const activeClass =
                      group.color === "violet" ? "border-violet-400 bg-violet-50 text-violet-700"
                      : group.color === "emerald" ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                      : "border-indigo-400 bg-indigo-50 text-indigo-700";
                    const iconClass =
                      group.color === "violet" ? (active ? "text-violet-600" : "text-gray-400")
                      : group.color === "emerald" ? (active ? "text-emerald-600" : "text-gray-400")
                      : (active ? "text-indigo-600" : "text-gray-400");
                    return (
                      <button
                        key={m.value}
                        onClick={() => setMode(m.value)}
                        className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                          active ? activeClass : "border-gray-200 hover:border-gray-300 text-gray-700"
                        }`}
                      >
                        <span className={`mt-0.5 shrink-0 ${iconClass}`}>
                          <ModeIcon mode={m.value} />
                        </span>
                        <div>
                          <p className="text-xs font-medium">{m.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{m.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Documents */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Documents{" "}
                <span className="font-normal text-gray-400">({selectedDocs.length} selected)</span>
              </label>
              {indexedDocs.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No indexed documents. Upload documents first.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {indexedDocs.map((doc) => {
                    const checked = selectedDocs.includes(doc.id);
                    return (
                      <label
                        key={doc.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                          checked ? "border-indigo-300 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
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
