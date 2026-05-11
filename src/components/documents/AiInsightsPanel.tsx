"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FlaggedValueBadge } from "@/components/shared/FlaggedValueBadge";
import type { Document } from "@/store/documentsStore";

interface DocumentEntity {
  id: string;
  document_id: string;
  entity_type: string;
  name: string;
  value?: string | null;
  unit?: string | null;
  raw_text?: string | null;
  created_at: string;
}

type FlagStatus = "HIGH" | "LOW" | "BORDERLINE" | "NORMAL";

interface FlaggedLabValue {
  name: string;
  value: string;
  unit: string;
  status: FlagStatus;
  reference_range: string;
}

interface LinkedDoc {
  id: string;
  title: string;
  activity_date: string | null;
  doc_type: string;
}

interface AiInsightsPanelProps {
  doc: Document;
  entities: DocumentEntity[];
  docId: string;
}

const SUMMARY_TRUNCATE = 300;

export function AiInsightsPanel({ doc, entities, docId }: AiInsightsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [flaggedValues, setFlaggedValues] = useState<FlaggedLabValue[]>([]);
  const [linkedDocs, setLinkedDocs] = useState<LinkedDoc[]>([]);
  const [showAllLinked, setShowAllLinked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [fv, ld] = await Promise.all([
        doc.category === "lab"
          ? invoke<FlaggedLabValue[]>("get_flagged_lab_values", { docId })
          : Promise.resolve([]),
        invoke<LinkedDoc[]>("get_linked_documents", { docId }),
      ]);
      if (!cancelled) {
        setFlaggedValues(fv);
        setLinkedDocs(ld);
      }
    }

    load().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [docId, doc.category]);

  const summary = doc.extracted_text ?? null;
  const isTruncated = summary !== null && summary.length > SUMMARY_TRUNCATE;
  const displaySummary =
    summary === null
      ? null
      : isTruncated && !expanded
        ? summary.slice(0, SUMMARY_TRUNCATE) + "…"
        : summary;

  const doctor = entities.find(
    (e) => e.entity_type === "contact" || e.entity_type === "doctor",
  );

  const visibleLinked = showAllLinked ? linkedDocs : linkedDocs.slice(0, 5);

  return (
    <section data-testid="ai-insights-panel" className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold text-gray-800">AI Insights</span>
        <svg
          className="h-4 w-4 text-gray-500 transition-transform duration-200"
          style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: collapsed ? 0 : 2000 }}
      >
        <div className="divide-y divide-gray-100 px-4 pb-4">
          {/* Section 1: Summary */}
          <div className="py-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Summary
            </p>
            {displaySummary ? (
              <>
                <p className="text-sm text-gray-700">{displaySummary}</p>
                {isTruncated && (
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => !e)}
                    className="mt-1 text-xs text-blue-600 hover:underline"
                  >
                    {expanded ? "Show less" : "Show more"}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">No summary available</p>
            )}
          </div>

          {/* Section 2: Flagged Lab Values (lab docs only) */}
          {doc.category === "lab" && (
            <div className="py-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Flagged Lab Values
              </p>
              {flaggedValues.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No flagged values</p>
              ) : (
                <ul className="space-y-1.5">
                  {flaggedValues.map((fv, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 text-gray-700">{fv.name}</span>
                      <span className="text-gray-600">
                        {fv.value}
                        {fv.unit ? ` ${fv.unit}` : ""}
                      </span>
                      {fv.reference_range && (
                        <span className="text-xs text-gray-400">({fv.reference_range})</span>
                      )}
                      <FlaggedValueBadge status={fv.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Section 3: Extracted Details */}
          <div className="py-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Extracted Details
            </p>
            <dl className="space-y-1 text-sm">
              {doctor && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-gray-500">Doctor</dt>
                  <dd className="text-gray-700">{doctor.name}</dd>
                </div>
              )}
              {doc.clinic_name && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-gray-500">Clinic</dt>
                  <dd className="text-gray-700">{doc.clinic_name}</dd>
                </div>
              )}
              {doc.activity_date && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-gray-500">Date</dt>
                  <dd className="text-gray-700">{doc.activity_date}</dd>
                </div>
              )}
              {doc.category && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-gray-500">Category</dt>
                  <dd className="text-gray-700">{doc.category}</dd>
                </div>
              )}
              {doc.tags && doc.tags.length > 0 && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-gray-500">Tags</dt>
                  <dd className="flex flex-wrap gap-1">
                    {doc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {!doctor && !doc.clinic_name && !doc.activity_date && (
                <p className="text-gray-400 italic">No details extracted</p>
              )}
            </dl>
          </div>

          {/* Section 4: Related Documents */}
          <div className="py-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Related Documents
            </p>
            {linkedDocs.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No related documents</p>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {visibleLinked.map((ld) => (
                    <li key={ld.id} className="text-sm">
                      <a
                        href={`/documents/${ld.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {ld.title || ld.id}
                      </a>
                      {ld.activity_date && (
                        <span className="ml-2 text-xs text-gray-400">{ld.activity_date}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {linkedDocs.length > 5 && !showAllLinked && (
                  <button
                    type="button"
                    data-testid="show-all-linked"
                    onClick={() => setShowAllLinked(true)}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    Show all ({linkedDocs.length})
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
