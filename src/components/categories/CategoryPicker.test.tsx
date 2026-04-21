import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoryPicker, type Category } from './CategoryPicker'

const MOCK_CATEGORIES: Category[] = [
  {
    id: 'c1',
    name: 'Cardiology',
    parentId: null,
    colorHex: '#EF4444',
    isSystem: true,
    sortOrder: 0,
  },
  {
    id: 'c2',
    name: 'Lab Results',
    parentId: null,
    colorHex: '#3B82F6',
    isSystem: true,
    sortOrder: 1,
  },
  {
    id: 'c3',
    name: 'Imaging',
    parentId: null,
    colorHex: '#8B5CF6',
    isSystem: true,
    sortOrder: 2,
  },
  {
    id: 'c4',
    name: 'Prescriptions',
    parentId: null,
    colorHex: '#10B981',
    isSystem: true,
    sortOrder: 3,
  },
  {
    id: 'c5',
    name: 'Blood Panels',
    parentId: 'c2',
    colorHex: '#60A5FA',
    isSystem: true,
    sortOrder: 10,
  },
  {
    id: 'c6',
    name: 'My Custom Category',
    parentId: null,
    colorHex: '#F59E0B',
    isSystem: false,
    sortOrder: 20,
  },
]

describe('CategoryPicker', () => {
  it('calls onChange with correct ids when clicking a category', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <CategoryPicker
        categories={MOCK_CATEGORIES}
        selectedIds={[]}
        onChange={onChange}
      />
    )

    const cardiologyButton = screen.getByRole('checkbox', {
      name: /Cardiology/i,
    })

    await user.click(cardiologyButton)

    expect(onChange).toHaveBeenCalledWith(['c1'])
  })

  it('deselects a selected category when clicked again', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <CategoryPicker
        categories={MOCK_CATEGORIES}
        selectedIds={['c1']}
        onChange={onChange}
      />
    )

    const cardiologyButton = screen.getByRole('checkbox', {
      name: /Cardiology/i,
    })

    await user.click(cardiologyButton)

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('shows delete button only on non-system categories', () => {
    render(
      <CategoryPicker
        categories={MOCK_CATEGORIES}
        selectedIds={[]}
        onChange={vi.fn()}
      />
    )

    // System categories should have lock icon
    const systemCategories = MOCK_CATEGORIES.filter(c => c.isSystem)
    systemCategories.forEach(cat => {
      const row = screen.getByRole('checkbox', { name: cat.name })
      const parent = row.parentElement
      expect(parent?.textContent).toContain('🔒')
    })

    // Non-system categories should have delete button
    const userCategory = screen.getByRole('checkbox', {
      name: /My Custom Category/i,
    })
    const parent = userCategory.parentElement
    const deleteButton = parent?.querySelector('button:not([aria-hidden])')
    expect(deleteButton).not.toBeNull()
    expect(deleteButton?.textContent).toContain('×')
  })

  it('calls onDeleteCategory when delete button is clicked', async () => {
    const onDeleteCategory = vi.fn()
    const user = userEvent.setup()

    render(
      <CategoryPicker
        categories={MOCK_CATEGORIES}
        selectedIds={[]}
        onChange={vi.fn()}
        onDeleteCategory={onDeleteCategory}
      />
    )

    const userCategory = screen.getByRole('checkbox', {
      name: /My Custom Category/i,
    })
    const parent = userCategory.parentElement
    const deleteButton = parent?.querySelector(
      'button:not([aria-hidden])'
    ) as HTMLButtonElement

    await user.click(deleteButton)

    expect(onDeleteCategory).toHaveBeenCalledWith('c6')
  })

  it('renders selected items as chips at the top', () => {
    render(
      <CategoryPicker
        categories={MOCK_CATEGORIES}
        selectedIds={['c1', 'c6']}
        onChange={vi.fn()}
      />
    )

    expect(screen.getAllByText('Cardiology').length).toBeGreaterThan(0)
    expect(screen.getAllByText('My Custom Category').length).toBeGreaterThan(0)
  })

  it('removes item from selection when chip close button is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    const { rerender } = render(
      <CategoryPicker
        categories={MOCK_CATEGORIES}
        selectedIds={['c1', 'c6']}
        onChange={onChange}
      />
    )

    const chips = screen.getAllByRole('button', { name: /remove/i })
    const firstChip = chips[0]!

    await user.click(firstChip)

    expect(onChange).toHaveBeenCalledWith(['c6'])
  })

  it('renders child categories indented under their parent', () => {
    render(
      <CategoryPicker
        categories={MOCK_CATEGORIES}
        selectedIds={[]}
        onChange={vi.fn()}
      />
    )

    const labResults = screen.getByRole('checkbox', { name: /Lab Results/i })
    const bloodPanels = screen.getByRole('checkbox', { name: /Blood Panels/i })

    // Blood Panels should have more left padding (pl-6) than Lab Results
    expect(bloodPanels.className).toContain('pl-6')
    expect(labResults.className).not.toContain('pl-6')
  })

  it('maintains selection across multiple clicks', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    const { rerender } = render(
      <CategoryPicker
        categories={MOCK_CATEGORIES}
        selectedIds={[]}
        onChange={onChange}
      />
    )

    const cardiology = screen.getByRole('checkbox', { name: /Cardiology/i })
    const labResults = screen.getByRole('checkbox', { name: /Lab Results/i })

    await user.click(cardiology)
    expect(onChange).toHaveBeenLastCalledWith(['c1'])

    rerender(
      <CategoryPicker
        categories={MOCK_CATEGORIES}
        selectedIds={['c1']}
        onChange={onChange}
      />
    )

    await user.click(labResults)
    expect(onChange).toHaveBeenLastCalledWith(['c1', 'c2'])
  })

  it('selects category when Enter key is pressed', () => {
    const onChange = vi.fn()

    render(
      <CategoryPicker
        categories={MOCK_CATEGORIES}
        selectedIds={[]}
        onChange={onChange}
      />
    )

    const cardiologyButton = screen.getByRole('checkbox', {
      name: /Cardiology/i,
    })

    fireEvent.keyDown(cardiologyButton, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['c1'])
  })

  it('selects category when Space key is pressed', () => {
    const onChange = vi.fn()

    render(
      <CategoryPicker
        categories={MOCK_CATEGORIES}
        selectedIds={[]}
        onChange={onChange}
      />
    )

    const cardiologyButton = screen.getByRole('checkbox', {
      name: /Cardiology/i,
    })

    fireEvent.keyDown(cardiologyButton, { key: ' ' })

    expect(onChange).toHaveBeenCalledWith(['c1'])
  })
})
