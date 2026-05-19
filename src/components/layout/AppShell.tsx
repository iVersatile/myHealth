'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { IconRail } from './IconRail'
import { TopBar } from './TopBar'
import { SearchModal } from '../search/SearchModal'

const redesignA = process.env.NEXT_PUBLIC_REDESIGN_A === 'true'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  if (redesignA) {
    return (
      <>
        {children}
        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      </>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-surface)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onSearchOpen={() => setSearchOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
