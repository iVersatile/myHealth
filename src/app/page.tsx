'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'

type Mode = 'unlock' | 'setup'

export default function LockScreen() {
  const router = useRouter()
  const { unlock, setup } = useAuth()

  const [mode, setMode] = useState<Mode>('unlock')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'setup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
    }

    setIsLoading(true)
    try {
      if (mode === 'unlock') {
        await unlock(password)
      } else {
        await setup(password)
      }
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (mode === 'unlock' && msg.includes('failed to read salt')) {
        setMode('setup')
        setPassword('')
        setError('No database found. Create a master password to get started.')
      } else if (mode === 'unlock') {
        setError('Incorrect password. Please try again.')
      } else {
        setError('Failed to create password. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const isSetup = mode === 'setup'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-[var(--text-3xl)] font-semibold tracking-tight text-[var(--color-text)]">
            myHealth
          </h1>
          <p className="mt-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            Your health records, private.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
            >
              Master Password
            </label>
            <input
              id="password"
              type="password"
              autoFocus
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSetup ? 'Create a master password' : 'Enter your master password'}
              required
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--text-base)] text-[var(--color-text)] placeholder:text-[var(--color-text-disabled)] outline-none transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>

          {isSetup && (
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
          )}

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
            {isLoading ? 'Please wait…' : isSetup ? 'Create & Unlock' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
