'use client'

import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IPC, extractTauriError } from '@/lib/ipc'

interface Category {
  id: string
  name: string
  parent_id: string | null
  color_hex: string
  is_system: boolean
  sort_order: number
  created_at: string
}

interface FlatCategory extends Category {
  depth: number
}

function buildFlatTree(categories: Category[]): FlatCategory[] {
  const result: FlatCategory[] = []
  const visit = (parentId: string | null, depth: number) => {
    const children = categories
      .filter((c) => c.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order)
    for (const c of children) {
      result.push({ ...c, depth })
      visit(c.id, depth + 1)
    }
  }
  visit(null, 0)
  return result
}

interface SortableRowProps {
  item: FlatCategory
  userCategories: Category[]
  onParentChange: (id: string, newParentId: string | null) => void
  onDelete: (id: string) => void
}

function SortableRow({ item, userCategories, onParentChange, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 hover:bg-[var(--color-surface-sunken)]"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <div style={{ width: item.depth * 20 }} />
      <span
        className="h-4 w-4 flex-shrink-0 rounded-full border border-[var(--color-border)]"
        style={{ backgroundColor: item.color_hex }}
      />
      <span className="flex-1 text-sm text-[var(--color-text)]">{item.name}</span>
      <select
        value={item.parent_id ?? ''}
        onChange={(e) => onParentChange(item.id, e.target.value || null)}
        className="rounded border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-2 py-1 text-xs text-[var(--color-text-secondary)] focus:outline-none"
      >
        <option value="">No parent</option>
        {userCategories
          .filter((c) => c.id !== item.id)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </select>
      <button
        onClick={() => onDelete(item.id)}
        className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-400/10 hover:text-red-300"
      >
        Delete
      </button>
    </div>
  )
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [newParentId, setNewParentId] = useState<string>('')
  const [creating, setCreating] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const loadCategories = useCallback(async () => {
    try {
      const result = await invoke<Category[]>(IPC.categoriesList)
      setCategories(result)
    } catch (e) {
      setError(extractTauriError(e))
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCategories()
  }, [loadCategories])

  const systemCategories = categories.filter((c) => c.is_system)
  const userCategories = categories.filter((c) => !c.is_system)
  const flatUser = buildFlatTree(userCategories)

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = flatUser.findIndex((c) => c.id === active.id)
    const newIndex = flatUser.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(flatUser, oldIndex, newIndex)

    const newParent = reordered[newIndex - 1]?.parent_id ?? null
    const newPosition = newIndex

    setCategories((prev) => {
      const moved = prev.find((c) => c.id === active.id)
      if (!moved) return prev
      return prev.map((c) =>
        c.id === active.id ? { ...c, parent_id: newParent, sort_order: newPosition } : c,
      )
    })

    try {
      await invoke(IPC.categoryReorder, {
        categoryId: String(active.id),
        newParentId: newParent,
        newPosition,
      })
    } catch (e) {
      setError(extractTauriError(e))
      loadCategories()
    }
  }

  const handleParentChange = async (id: string, newPId: string | null) => {
    try {
      await invoke(IPC.categoryReorder, {
        categoryId: id,
        newParentId: newPId,
        newPosition: 100,
      })
      loadCategories()
    } catch (e) {
      setError(extractTauriError(e))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await invoke(IPC.categoriesDelete, { id })
      loadCategories()
    } catch (e) {
      setError(extractTauriError(e))
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await invoke(IPC.categoriesCreate, {
        name: newName.trim(),
        colorHex: newColor,
        parentId: newParentId || null,
      })
      setNewName('')
      setNewParentId('')
      loadCategories()
    } catch (e) {
      setError(extractTauriError(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Categories</h1>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {systemCategories.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            System Categories
          </h2>
          {systemCategories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2"
            >
              <span
                className="h-4 w-4 flex-shrink-0 rounded-full border border-[var(--color-border)]"
                style={{ backgroundColor: c.color_hex }}
              />
              <span className="flex-1 text-sm text-[var(--color-text-secondary)]">{c.name}</span>
              <span className="text-xs text-[var(--color-text-muted)]">System</span>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Your Categories
        </h2>
        {flatUser.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No categories yet. Add one below.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={flatUser.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {flatUser.map((item) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    userCategories={userCategories}
                    onParentChange={handleParentChange}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Add Category
        </h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]">Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              required
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]">Color</label>
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)]">Parent</label>
            <select
              value={newParentId}
              onChange={(e) => setNewParentId(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none"
            >
              <option value="">None</option>
              {userCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {creating ? 'Adding…' : 'Add'}
          </button>
        </form>
      </section>
    </div>
  )
}
