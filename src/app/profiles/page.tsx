'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@tauri-apps/api/core'

interface ProfileEntry {
  id: string
  name: string
  db_path: string
  created_at: string
}

function tauriErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    if (typeof obj['InvalidInput'] === 'string') return obj['InvalidInput']
    if (typeof obj['Internal'] === 'string') return obj['Internal']
    if (typeof obj['message'] === 'string') return obj['message']
  }
  return String(err)
}

export default function ProfilesPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<ProfileEntry[]>([])
  const [selected, setSelected] = useState<ProfileEntry | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    invoke<ProfileEntry[]>('profiles_list')
      .then(setProfiles)
      .catch(() => setError('Failed to load profiles.'))
  }, [])

  function handleSelectProfile(profile: ProfileEntry) {
    setSelected(profile)
    setPassword('')
    setError(null)
  }

  function handleBack() {
    setSelected(null)
    setPassword('')
    setError(null)
  }

  async function handleUnlock(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    setError(null)
    setIsLoading(true)
    try {
      await invoke('profiles_switch', { id: selected.id, password })
      router.push('/documents')
    } catch (err: unknown) {
      const msg = tauriErrorMessage(err)
      if (msg.includes('incorrect password')) {
        setError('Incorrect password. Please try again.')
      } else {
        setError('Failed to unlock profile. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (selected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] px-4">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-center">
            <h1 className="text-[var(--text-3xl)] font-semibold tracking-tight text-[var(--color-text)]">
              myHealth
            </h1>
            <p className="mt-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
              {selected.name}
            </p>
          </div>

          <form onSubmit={handleUnlock} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter profile password"
                required
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-base)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] outline-none transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-[var(--radius-sm)] bg-[var(--color-danger)]/10 px-3 py-2 text-[var(--text-sm)] text-[var(--color-danger)]"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2.5 text-[var(--text-sm)] font-medium text-[var(--color-text-inverse)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {isLoading ? 'Please wait…' : 'Unlock'}
            </button>

            <button
              type="button"
              onClick={handleBack}
              className="text-center text-[var(--text-sm)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
            >
              Back to profiles
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-[var(--text-3xl)] font-semibold tracking-tight text-[var(--color-text)]">
            myHealth
          </h1>
          <p className="mt-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            Select a profile
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-[var(--radius-sm)] bg-[var(--color-danger)]/10 px-3 py-2 text-[var(--text-sm)] text-[var(--color-danger)]"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2" data-testid="profile-list">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              data-testid="profile-item"
              onClick={() => handleSelectProfile(profile)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3 text-left text-[var(--text-base)] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary)]"
            >
              {profile.name}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <button
            type="button"
            data-testid="new-profile-btn"
            onClick={() => router.push('/profiles/new')}
            className="w-full rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-3 text-[var(--text-sm)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            + New Profile
          </button>
        </div>
      </div>
    </div>
  )
}
