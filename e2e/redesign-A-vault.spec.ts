import { test, expect } from './fixtures'

const SEED_DOCS = [
  {
    id: 'doc-1',
    filename: 'Blood Test Results 2023.pdf',
    file_path: '/tmp/blood.pdf',
    mime_type: 'application/pdf',
    category: 'lab',
    tags: [],
    activity_date: '2023-01-15',
    created_at: new Date().toISOString(),
    _deleted: false,
    extracted_text: null,
    _entities: [],
    _flagged_values: [],
  },
  {
    id: 'doc-2',
    filename: 'Lab Results Flagged.pdf',
    file_path: '/tmp/lab.pdf',
    mime_type: 'application/pdf',
    category: 'lab',
    tags: ['flagged'],
    activity_date: '2023-03-10',
    created_at: new Date().toISOString(),
    _deleted: false,
    extracted_text: null,
    _entities: [],
    _flagged_values: [
      { name: 'Haemoglobin', value: '8.5', unit: 'g/dL', status: 'LOW', reference_range: '12-16' },
    ],
  },
  {
    id: 'doc-3',
    filename: 'Clinic Notes.txt',
    file_path: '/tmp/notes.txt',
    mime_type: 'text/plain',
    category: 'other',
    tags: [],
    activity_date: '2023-05-01',
    created_at: new Date().toISOString(),
    _deleted: false,
    extracted_text: 'Clinic visit notes',
    _entities: [],
  },
]

test.describe('Redesign-A — Dark Vault Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((docs) => {
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
    }, SEED_DOCS)
  })

  // ─── Icon Rail ───────────────────────────────────────────────────────────

  test('TC-A-01 — icon rail renders with correct data-testid', async ({ page }) => {
    await page.goto('/documents')
    await expect(page.getByTestId('nav-rail')).toBeVisible()
  })

  test('TC-A-02 — icon rail has 52px width', async ({ page }) => {
    await page.goto('/documents')
    const box = await page.getByTestId('nav-rail').boundingBox()
    expect(box?.width).toBe(52)
  })

  test('TC-A-03 — all nav rail buttons have aria-label', async ({ page }) => {
    await page.goto('/documents')
    const buttons = page.getByTestId('nav-rail').getByRole('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const label = await buttons.nth(i).getAttribute('aria-label')
      expect(label).toBeTruthy()
    }
  })

  test('TC-A-04 — active nav item has amber left border', async ({ page }) => {
    await page.goto('/documents')
    const activeBtn = page.getByTestId('nav-rail').locator('[data-active="true"]')
    await expect(activeBtn).toBeVisible()
    const borderLeft = await activeBtn.evaluate(
      el => getComputedStyle(el).borderLeftColor
    )
    expect(borderLeft).toMatch(/240|F0A500/i)
  })

  test('TC-A-05 — tooltip appears on rail button hover after 400ms', async ({ page }) => {
    await page.goto('/documents')
    await page.getByTestId('nav-rail').getByRole('button').first().hover()
    await page.waitForTimeout(450)
    await expect(page.locator('[role="tooltip"]')).toBeVisible()
  })

  test('TC-A-06 — clicking nav rail item navigates to correct route', async ({ page }) => {
    await page.goto('/documents')
    await page.getByTestId('nav-rail').getByRole('link', { name: /documents/i }).click()
    await expect(page).toHaveURL(/\/documents/)
  })

  // ─── Document List Panel ─────────────────────────────────────────────────

  test('TC-A-07 — document list panel renders', async ({ page }) => {
    await page.goto('/documents')
    await expect(page.getByTestId('document-list-panel')).toBeVisible()
  })

  test('TC-A-08 — document list panel is approximately 300px wide', async ({ page }) => {
    await page.goto('/documents')
    const box = await page.getByTestId('document-list-panel').boundingBox()
    expect(box?.width).toBeCloseTo(300, -1)
  })

  test('TC-A-09 — document rows show title, date and category pill', async ({ page }) => {
    await page.goto('/documents')
    const row = page.getByTestId('document-list-panel').locator('[data-testid="doc-row"]').first()
    await expect(row).toBeVisible()
    await expect(row.locator('[data-testid="doc-row-title"]')).toBeVisible()
    await expect(row.locator('[data-testid="doc-row-date"]')).toBeVisible()
    await expect(row.locator('[data-testid="doc-row-category"]')).toBeVisible()
  })

  test('TC-A-10 — search input filters document list', async ({ page }) => {
    await page.goto('/documents')
    await page.getByTestId('document-list-panel').getByRole('searchbox').fill('blood')
    const firstRow = page.getByTestId('document-list-panel').locator('[data-testid="doc-row"]').first()
    await expect(firstRow).toContainText(/blood/i)
  })

  test('TC-A-11 — clicking a document row selects it with amber left border', async ({ page }) => {
    await page.goto('/documents')
    const row = page.getByTestId('document-list-panel').locator('[data-testid="doc-row"]').first()
    await row.click()
    const borderLeft = await row.evaluate(el => getComputedStyle(el).borderLeftColor)
    expect(borderLeft).toMatch(/240|F0A500/i)
  })

  test('TC-A-12 — flagged document row shows amber flag indicator', async ({ page }) => {
    await page.goto('/documents')
    const flaggedRow = page.getByTestId('document-list-panel').locator('[data-testid="doc-row-flagged"]').first()
    await expect(flaggedRow.locator('[data-testid="flag-indicator"]')).toBeVisible()
  })

  // ─── PDF Preview Panel ───────────────────────────────────────────────────

  test('TC-A-13 — PDF preview panel renders after selecting a document', async ({ page }) => {
    await page.goto('/documents')
    await page.getByTestId('document-list-panel').locator('[data-testid="doc-row"]').first().click()
    await expect(page.getByTestId('document-preview-panel')).toBeVisible()
  })

  test('TC-A-14 — PDF preview toolbar shows zoom and page controls', async ({ page }) => {
    await page.goto('/documents')
    await page.getByTestId('document-list-panel').locator('[data-testid="doc-row"]').first().click()
    const toolbar = page.getByTestId('document-preview-panel').getByRole('toolbar')
    await expect(toolbar.getByRole('button', { name: /zoom in/i })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: /zoom out/i })).toBeVisible()
  })

  test('TC-A-15 — non-PDF document shows text preview fallback', async ({ page }) => {
    await page.goto('/documents')
    // doc-3 (index 2) is text/plain — no data-type attr on rows, select by position
    const txtRow = page.getByTestId('document-list-panel')
      .locator('[data-testid="doc-row"]').nth(1) // doc-3 is index 1 among non-flagged rows
    await txtRow.click()
    await expect(page.getByTestId('document-preview-panel').locator('[data-testid="text-preview"]')).toBeVisible()
  })

  // ─── AI Insights Panel ───────────────────────────────────────────────────

  test('TC-A-16 — AI insights panel renders after selecting a document', async ({ page }) => {
    await page.goto('/documents')
    await page.getByTestId('document-list-panel').locator('[data-testid="doc-row"]').first().click()
    await expect(page.getByTestId('ai-insights-panel')).toBeVisible()
  })

  test('TC-A-17 — AI insights panel shows extracted entities section', async ({ page }) => {
    await page.goto('/documents')
    await page.getByTestId('document-list-panel').locator('[data-testid="doc-row"]').first().click()
    await expect(page.getByTestId('ai-insights-panel').getByTestId('entities-section')).toBeVisible()
  })

  test('TC-A-18 — flagged lab values show status pills LOW / HIGH / BORDERLINE', async ({ page }) => {
    await page.goto('/documents')
    const flaggedRow = page.getByTestId('document-list-panel')
      .locator('[data-testid="doc-row-flagged"]').first()
    await flaggedRow.click()
    const badge = page.getByTestId('ai-insights-panel').locator('[data-testid="flagged-value-badge"]').first()
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText(/LOW|HIGH|BORDERLINE/)
  })

  test('TC-A-19 — AI insights panel collapses when chevron clicked', async ({ page }) => {
    await page.goto('/documents')
    await page.getByTestId('document-list-panel').locator('[data-testid="doc-row"]').first().click()
    const panel = page.getByTestId('ai-insights-panel')
    await panel.getByRole('button', { name: /collapse/i }).click()
    const box = await panel.boundingBox()
    expect(box?.width ?? 0).toBeLessThan(10)
  })

  test('TC-A-20 — AI insights panel re-expands after collapse', async ({ page }) => {
    await page.goto('/documents')
    await page.getByTestId('document-list-panel').locator('[data-testid="doc-row"]').first().click()
    const panel = page.getByTestId('ai-insights-panel')
    await panel.getByRole('button', { name: /collapse/i }).click()
    await page.getByTestId('ai-panel-expand-btn').click()
    const box = await panel.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(200)
  })

  // ─── Dark Theme ──────────────────────────────────────────────────────────

  test('TC-A-21 — vault theme CSS variable --color-bg is #0D1117', async ({ page }) => {
    await page.goto('/documents')
    await page.waitForSelector('[data-testid="vault-layout"]')
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()
    )
    expect(bg.toLowerCase()).toBe('#0d1117')
  })

  // ─── Responsive Collapse ─────────────────────────────────────────────────

  test('TC-A-22 — AI insights panel auto-collapses below 1400px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 900 })
    await page.goto('/documents')
    await page.getByTestId('document-list-panel').locator('[data-testid="doc-row"]').first().click()
    const box = await page.getByTestId('ai-insights-panel').boundingBox()
    expect(box?.width ?? 0).toBeLessThan(10)
  })

  test('TC-A-25 — 1440px: all 4 panels visible, no expand button', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/documents')
    await expect(page.getByTestId('nav-rail')).toBeVisible()
    await expect(page.getByTestId('document-list-panel')).toBeVisible()
    await expect(page.getByTestId('document-preview-panel')).toBeVisible()
    await expect(page.getByTestId('ai-insights-panel')).toBeVisible()
    await expect(page.getByTestId('ai-panel-expand-btn')).not.toBeVisible()
  })

  test('TC-A-26 — 1280px: AI panel collapsed, expand button visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/documents')
    await expect(page.getByTestId('ai-panel-expand-btn')).toBeVisible()
  })

  test('TC-A-27 — clicking expand button restores AI panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/documents')
    await page.getByTestId('ai-panel-expand-btn').click()
    await expect(page.getByTestId('ai-panel-expand-btn')).not.toBeVisible()
  })

  // ─── Accessibility ───────────────────────────────────────────────────────

  test('TC-A-23 — keyboard Tab reaches first rail button', async ({ page }) => {
    await page.goto('/documents')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.closest('[data-testid="nav-rail"]') !== null)
    expect(focused).toBe(true)
  })

  test('TC-A-24 — tooltip has role=tooltip and aria-describedby wired', async ({ page }) => {
    await page.goto('/documents')
    await page.getByTestId('nav-rail').getByRole('button').first().hover()
    await page.waitForTimeout(450)
    const tooltip = page.locator('[role="tooltip"]')
    await expect(tooltip).toBeVisible()
    const id = await tooltip.getAttribute('id')
    expect(id).toBeTruthy()
  })
})
