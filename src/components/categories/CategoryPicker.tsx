'use client'

import { useMemo } from 'react'

export interface Category {
  id: string
  name: string
  parentId: string | null
  colorHex: string
  isSystem: boolean
  sortOrder: number
}

interface CategoryPickerProps {
  categories: Category[]
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  onDeleteCategory?: (categoryId: string) => void
}

export function CategoryPicker({
  categories,
  selectedIds,
  onChange,
  onDeleteCategory,
}: CategoryPickerProps) {
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  )

  const selectedItems = useMemo(
    () => sortedCategories.filter(cat => selectedIds.includes(cat.id)),
    [sortedCategories, selectedIds]
  )

  const toggleCategory = (categoryId: string) => {
    const newSelectedIds = selectedIds.includes(categoryId)
      ? selectedIds.filter(id => id !== categoryId)
      : [...selectedIds, categoryId]
    onChange(newSelectedIds)
  }

  const handleKeyDown = (
    e: React.KeyboardEvent,
    categoryId: string
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleCategory(categoryId)
    }
  }

  const handleDeleteCategory = (e: React.MouseEvent, categoryId: string) => {
    e.stopPropagation()
    onDeleteCategory?.(categoryId)
  }

  const renderCategoryItem = (category: Category, depth: number) => {
    const isSelected = selectedIds.includes(category.id)
    const indent = depth > 0 ? 'pl-6' : 'pl-0'

    return (
      <div
        key={category.id}
        className={`${indent} flex items-center gap-2 py-2 px-3 rounded-sm cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-800`}
        onClick={() => toggleCategory(category.id)}
        onKeyDown={e => handleKeyDown(e, category.id)}
        role="checkbox"
        aria-checked={isSelected}
        aria-label={category.name}
        tabIndex={0}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="w-4 h-4 rounded"
          style={{
            backgroundColor: isSelected ? category.colorHex : 'var(--color-surface)',
            borderColor: category.colorHex,
            borderWidth: '1px',
          }}
          aria-hidden="true"
        />
        <span className="flex-1 text-sm" style={{ color: 'var(--color-text)' }}>
          {category.name}
        </span>
        {category.isSystem ? (
          <span className="text-xs" aria-label="system category">
            🔒
          </span>
        ) : (
          <button
            className="text-xs hover:text-red-600 dark:hover:text-red-400 transition-colors"
            onClick={e => handleDeleteCategory(e, category.id)}
            aria-label={`delete category ${category.name}`}
            style={{ color: 'var(--color-text)' }}
          >
            ×
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Selected items chips */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedItems.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-2 px-3 py-1 rounded-full text-sm"
              style={{
                backgroundColor: item.colorHex + '20',
                borderLeft: `3px solid ${item.colorHex}`,
                color: 'var(--color-text)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.colorHex }}
              />
              {item.name}
              <button
                className="ml-1 font-bold hover:opacity-70 transition-opacity"
                onClick={() => toggleCategory(item.id)}
                aria-label={`remove ${item.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Category list */}
      <div
        className="border rounded-md p-3"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <div className="space-y-0">
          {sortedCategories.map(category => {
            const children = sortedCategories.filter(
              cat => cat.parentId === category.id
            )
            if (category.parentId === null) {
              return (
                <div key={category.id}>
                  {renderCategoryItem(category, 0)}
                  {children.map(child => renderCategoryItem(child, 1))}
                </div>
              )
            }
            return null
          })}
        </div>
      </div>
    </div>
  )
}
