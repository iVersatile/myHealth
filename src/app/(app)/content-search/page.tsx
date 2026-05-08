'use client'
import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { invoke } from '@tauri-apps/api/core'

interface ContentSearchResult {
  id: string
  title: string
  activity_date: string | null
  snippet: string
  provider_tag: string | null
}
interface ContentSearchSummary {
  first_date: string | null
  last_date: string | null
  doc_count: number
  unique_providers: number
}
interface ContentSearchResponse {
  results: ContentSearchResult[]
  summary: ContentSearchSummary
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function providerLabel(tag: string | null): string | null {
  if (!tag) return null
  return tag.startsWith('dr:') ? tag.slice(3) : tag
}

function SnippetText({ raw }: { raw: string }) {
  const parts = raw.split(/(<mark>.*?<\/mark>)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
          return (
            <mark
              key={i}
              className="bg-yellow-200 text-yellow-900 rounded px-0.5 not-italic"
            >
              {part.slice(6, -7)}
            </mark>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

function ResultCard({ result }: { result: ContentSearchResult }) {
  const provider = providerLabel(result.provider_tag)
  return (
    <Link href={`/documents/view?id=${result.id}`} className="block group no-underline">
      <div className="flex gap-4">
        <div className="flex flex-col items-center">
          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[var(--color-accent)] group-hover:scale-125 transition-transform" />
          <div className="w-px flex-1 bg-[var(--color-border)] mt-1" />
        </div>
        <div className="pb-5 flex-1 min-w-0 rounded-md px-3 py-2 -ml-1 transition-colors group-hover:bg-[var(--color-surface-raised)]">
          <div className="flex items-start gap-3 mb-1">
            <span className="text-xs text-[var(--color-text-muted)] shrink-0 w-24 mt-0.5">
              {formatDate(result.activity_date)}
            </span>
            {provider && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-tag-bg)] text-[var(--color-tag-text)] shrink-0">
                {provider}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-[var(--color-text)] truncate group-hover:text-[var(--color-accent)] mb-1">
            {result.title}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-3">
            <SnippetText raw={result.snippet} />
          </p>
        </div>
      </div>
    </Link>
  )
}

function SummaryBar({ summary }: { summary: ContentSearchSummary }) {
  const items = [
    { label: 'Documents', value: String(summary.doc_count) },
    { label: 'First mention', value: formatDate(summary.first_date) },
    { label: 'Last mention', value: formatDate(summary.last_date) },
    { label: 'Providers', value: String(summary.unique_providers) },
  ]
  return (
    <div
      data-testid="summary-bar"
      className="flex flex-wrap gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3 mb-6"
    >
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col min-w-[80px]">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-text-muted)]">
            {label}
          </span>
          <span className="text-sm font-semibold text-[var(--color-text)] mt-0.5">{value}</span>
        </div>
      ))}
    </div>
  )
}

export default function ContentSearchPage() {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState<ContentSearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setResponse(null)
      setError(null)
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const res = await invoke<ContentSearchResponse>('documents_content_search', {
        query: trimmed,
      })
      if (!ctrl.signal.aborted) setResponse(res)
    } catch (e) {
      if (!ctrl.signal.aborted) {
        setError(e instanceof Error ? e.message : String(e))
        setResponse(null)
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') void search(query)
  }

  const hasResults = response !== null && response.results.length > 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text)] mb-2">
        Content Search
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        Search extracted text across all your documents.
      </p>

      <div className="flex gap-2 mb-6">
        <input
          type="search"
          data-testid="content-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. hypertension, blood pressure…"
          className="flex-1 px-4 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] text-sm"
        />
        <button
          type="button"
          onClick={() => void search(query)}
          disabled={loading || !query.trim()}
          className="px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {hasResults && <SummaryBar summary={response.summary} />}

      {response !== null && response.results.length === 0 && !loading && (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          <p className="text-lg mb-2">No documents found</p>
          <p className="text-sm">Try a different search term.</p>
        </div>
      )}

      {hasResults && (
        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            {response.summary.doc_count} document{response.summary.doc_count !== 1 ? 's' : ''} —
            oldest first
          </p>
          {response.results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}
