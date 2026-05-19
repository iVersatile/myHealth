'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { invoke } from '@tauri-apps/api/core'
import { extractTauriError } from '@/lib/ipc'

export default function NewProfilePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Profile name is required.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    try {
      await invoke('profiles_create', { name: name.trim(), password })
      router.push('/profiles')
    } catch (err: unknown) {
      setError(extractTauriError(err) || 'Failed to create profile. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-[var(--text-3xl)] font-semibold tracking-tight text-[var(--color-text)]">
            New Profile
          </h1>
          <p className="mt-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            Create a separate encrypted vault
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="name"
              className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
            >
              Profile Name
            </label>
            <input
              id="name"
              type="text"
              autoFocus
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ying, Work, Family"
              required
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-base)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] outline-none transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>

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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-base)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] outline-none transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirmPassword"
              className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
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
            {isLoading ? 'Creating…' : 'Create Profile'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/profiles')}
            className="text-center text-[var(--text-sm)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  )
}
