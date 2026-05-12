import { test, expect } from './fixtures'

const SEED = [
  {
    id: 'doc-1',
    filename: 'Blood Test.pdf',
    file_path: '/tmp/blood.pdf',
    mime_type: 'application/pdf',
    category: 'lab',
    tags: [],
    activity_date: '2023-01-15',
    created_at: new Date().toISOString(),
    _deleted: false,
    extracted_text: 'Test content',
    _entities: [],
  },
]

function seedInvoke(page: import('@playwright/test').Page) {
  return page.addInitScript((docs) => {
    const STATE_KEY = 'tauri_mock_state'
    const state = {
      documents: docs,
      contacts: [],
      clinics: [],
      appointments: [],
      notes: [],
      categories: [],
      trash: [],
      symptoms: [],
      medications: [],
      entity_links: [],
    }
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
  }, SEED)
}

test.describe('Redesign-A keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await seedInvoke(page)
    await page.goto('/documents')
    await page.waitForSelector('[data-testid="vault-layout"]', { timeout: 10_000 })
  })

  test('Tab reaches nav-rail before document list', async ({ page }) => {
    await page.keyboard.press('Tab')
    const inRail = await page.evaluate(
      () => document.activeElement?.closest('[data-testid="nav-rail"]') !== null,
    )
    expect(inRail).toBe(true)
  })

  test('Tab moves focus into document list panel search input', async ({ page }) => {
    // Tab through all nav-rail buttons then reach filter-search
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      const testid = await page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.dataset?.testid ?? '',
      )
      if (testid === 'filter-search') break
    }
    const testid = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset?.testid ?? '',
    )
    expect(testid).toBe('filter-search')
  })

  test('Tab reaches category select after search input', async ({ page }) => {
    await page.getByTestId('filter-search').focus()
    await page.keyboard.press('Tab')
    const testid = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset?.testid ?? '',
    )
    expect(testid).toBe('filter-category')
  })

  test('date-from and date-to inputs are focusable', async ({ page }) => {
    // date inputs have internal sub-parts in Chrome so we test direct focus, not Tab sequence
    await page.getByTestId('filter-date-from').focus()
    const t1 = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset?.testid ?? '',
    )
    expect(t1).toBe('filter-date-from')

    await page.getByTestId('filter-date-to').focus()
    const t2 = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset?.testid ?? '',
    )
    expect(t2).toBe('filter-date-to')
  })

  test('focus indicators are visible on nav-rail buttons', async ({ page }) => {
    await page.keyboard.press('Tab')
    const outlineStyle = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return ''
      return window.getComputedStyle(el).outline
    })
    expect(outlineStyle).not.toMatch(/^0px/)
  })

  test('preview toolbar is reachable via keyboard after selecting a doc row', async ({ page }) => {
    await page.getByTestId('document-list-panel').locator('[data-testid="doc-row"]').first().click()
    await page.waitForSelector('[data-testid="preview-toolbar"]', { timeout: 5_000 })

    const toolbar = page.getByTestId('preview-toolbar')
    await expect(toolbar).toBeVisible()
    const firstBtn = toolbar.locator('button, [tabindex]').first()
    await firstBtn.focus()
    const inToolbar = await page.evaluate(
      () => document.activeElement?.closest('[data-testid="preview-toolbar"]') !== null,
    )
    expect(inToolbar).toBe(true)
  })
})
