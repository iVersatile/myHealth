'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, UserEntry } from '../hooks/useAuth'

type Mode = 'unlock' | 'setup' | 'pick-user' | 'switch-user'

function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) {
    return 'Password must be at least 12 characters.'
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.'
  }

  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.'
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit.'
  }

  if (!/[!@#$%^&*()_+\-=\[\]{}|;':",.<>?/]/.test(password)) {
    return 'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;\':",.<>?/).'
  }

  return null
}

function tauriErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    if (typeof obj['Internal'] === 'string') return obj['Internal']
    if (typeof obj['message'] === 'string') return obj['message']
  }
  return String(err)
}

export default function LockScreen() {
  const router = useRouter()
  const { unlock, setup, hasPassword, listUsers, switchUser } = useAuth()

  const [mode, setMode] = useState<Mode>('unlock')
  const [users, setUsers] = useState<UserEntry[]>([])
  const [selectedUser, setSelectedUser] = useState<UserEntry | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    Promise.all([hasPassword(), listUsers()]).then(([exists, roster]) => {
      if (roster.length > 0) {
        setUsers(roster)
        setMode('pick-user')
      } else if (!exists) {
        setMode('setup')
      }
    }).catch(() => {
      // Stay in unlock mode; user will see an error on submit
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'setup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }

      const strengthError = validatePasswordStrength(password)
      if (strengthError) {
        setError(strengthError)
        return
      }
    }

    setIsLoading(true)
    try {
      if (mode === 'switch-user' && selectedUser) {
        await switchUser(selectedUser.id, password)
      } else if (mode === 'unlock') {
        await unlock(password)
      } else if (mode === 'setup') {
        await setup(password)
      }
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = tauriErrorMessage(err)
      if (mode === 'unlock' && msg.includes('failed to read salt')) {
        setMode('setup')
        setPassword('')
        setError('No database found. Create a master password to get started.')
      } else if (mode === 'unlock' || mode === 'switch-user') {
        setError('Incorrect password. Please try again.')
      } else {
        setError('Failed to create password. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (mode === 'pick-user') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] px-4">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-center">
            <h1 className="text-[var(--text-3xl)] font-semibold tracking-tight text-[var(--color-text)]">
              myHealth
            </h1>
            <p className="mt-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
              Who is using this device?
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  setSelectedUser(user)
                  setPassword('')
                  setError(null)
                  setMode('switch-user')
                }}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3 text-left text-[var(--text-base)] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary)]"
              >
                {user.display_name}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const isSetup = mode === 'setup'
  const isSwitchUser = mode === 'switch-user'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-[var(--text-3xl)] font-semibold tracking-tight text-[var(--color-text)]">
            myHealth
          </h1>
          <p className="mt-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            {isSwitchUser && selectedUser
              ? `Welcome back, ${selectedUser.display_name}`
              : 'Your health records, private.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-[var(--text-sm)] font-medium text-[var(--color-text)]"
            >
              {isSetup ? 'Master Password' : 'Password'}
            </label>
            <input
              id="password"
              type="password"
              autoFocus
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSetup ? 'Create a master password' : 'Enter your password'}
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

          {isSwitchUser && users.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMode('pick-user')
                setSelectedUser(null)
                setPassword('')
                setError(null)
              }}
              className="text-center text-[var(--text-sm)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
            >
              Back to user list
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
