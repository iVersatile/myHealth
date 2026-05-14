import { test, expect } from './fixtures'

test.describe('Redesign-D — macOS Bento Dashboard', () => {
  // ─── Grid Layout ─────────────────────────────────────────────────────────

  test('TC-BENTO-01 — bento grid container renders with correct data-testid', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('bento-grid')).toBeVisible()
  })

  test('TC-BENTO-02 — bento grid has 3-column layout at 1440px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const grid = page.getByTestId('bento-grid')
    const columns = await grid.evaluate(el =>
      getComputedStyle(el).gridTemplateColumns
    )
    expect(columns.split(' ').length).toBe(3)
  })

  test('TC-BENTO-03 — bento grid has 16px gap', async ({ page }) => {
    await page.goto('/')
    const gap = await page.getByTestId('bento-grid').evaluate(el =>
      getComputedStyle(el).gap
    )
    expect(gap).toBe('16px')
  })

  // ─── Recent Documents Tile ────────────────────────────────────────────────

  test('TC-BENTO-04 — recent docs tile renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('bento-tile-recent-docs')).toBeVisible()
  })

  test('TC-BENTO-05 — recent docs tile shows up to 5 document rows', async ({ page }) => {
    await page.goto('/')
    const rows = page.getByTestId('bento-tile-recent-docs').locator('[data-testid="recent-doc-row"]')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(5)
  })

  test('TC-BENTO-06 — clicking a recent doc row navigates to documents page', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('bento-tile-recent-docs').locator('[data-testid="recent-doc-row"]').first().click()
    await expect(page).toHaveURL(/\/documents/)
  })

  // ─── Health Score Tile ────────────────────────────────────────────────────

  test('TC-BENTO-07 — health score tile renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('bento-tile-health-score')).toBeVisible()
  })

  test('TC-BENTO-08 — health score tile shows SVG ring', async ({ page }) => {
    await page.goto('/')
    const svg = page.getByTestId('bento-tile-health-score').locator('svg')
    await expect(svg).toBeVisible()
  })

  test('TC-BENTO-09 — health score tile shows numeric score', async ({ page }) => {
    await page.goto('/')
    const score = page.getByTestId('bento-tile-health-score').locator('[data-testid="health-score-value"]')
    await expect(score).toBeVisible()
    const text = await score.textContent()
    expect(Number(text)).toBeGreaterThanOrEqual(0)
    expect(Number(text)).toBeLessThanOrEqual(100)
  })

  test('TC-BENTO-10 — health score tile shows trend arrow', async ({ page }) => {
    await page.goto('/')
    const trend = page.getByTestId('bento-tile-health-score').locator('[data-testid="health-score-trend"]')
    await expect(trend).toBeVisible()
    const text = await trend.textContent()
    expect(text).toMatch(/↑|↓|→/)
  })

  // ─── Flagged Values Tile ──────────────────────────────────────────────────

  test('TC-BENTO-11 — flagged values tile renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('bento-tile-flagged-values')).toBeVisible()
  })

  test('TC-BENTO-12 — flagged values rows show status pill HIGH or LOW', async ({ page }) => {
    await page.goto('/')
    const pills = page.getByTestId('bento-tile-flagged-values').locator('[data-testid="flagged-status-pill"]')
    const count = await pills.count()
    if (count > 0) {
      const text = await pills.first().textContent()
      expect(text).toMatch(/HIGH|LOW|BORDERLINE/)
    }
  })

  // ─── Timeline Tile ────────────────────────────────────────────────────────

  test('TC-BENTO-13 — timeline tile renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('bento-tile-timeline')).toBeVisible()
  })

  test('TC-BENTO-14 — timeline tile has horizontal scroll container', async ({ page }) => {
    await page.goto('/')
    const scroll = page.getByTestId('bento-tile-timeline').locator('[data-testid="timeline-scroll"]')
    await expect(scroll).toBeVisible()
    const overflow = await scroll.evaluate(el => getComputedStyle(el).overflowX)
    expect(overflow).toMatch(/auto|scroll/)
  })

  test('TC-BENTO-15 — clicking timeline tile area navigates to /timeline', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('bento-tile-timeline').getByRole('link', { name: /timeline/i }).click()
    await expect(page).toHaveURL(/\/timeline/)
  })

  // ─── Reminders Tile ───────────────────────────────────────────────────────

  test('TC-BENTO-16 — reminders tile renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('bento-tile-reminders')).toBeVisible()
  })

  test('TC-BENTO-17 — reminders tile shows empty state CTA when no reminders', async ({ page }) => {
    await page.goto('/')
    const tile = page.getByTestId('bento-tile-reminders')
    const items = tile.locator('[data-testid="reminder-item"]')
    const count = await items.count()
    if (count === 0) {
      await expect(tile.locator('[data-testid="reminders-empty-cta"]')).toBeVisible()
    }
  })

  // ─── Doctors Tile ─────────────────────────────────────────────────────────

  test('TC-BENTO-18 — doctors tile renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('bento-tile-doctors')).toBeVisible()
  })

  test('TC-BENTO-19 — doctors tile shows doctor cards with initials', async ({ page }) => {
    await page.goto('/')
    const cards = page.getByTestId('bento-tile-doctors').locator('[data-testid="doctor-card"]')
    const count = await cards.count()
    if (count > 0) {
      await expect(cards.first().locator('[data-testid="doctor-initials"]')).toBeVisible()
    }
  })

  test('TC-BENTO-20 — clicking a doctor card navigates to contacts page', async ({ page }) => {
    await page.goto('/')
    const cards = page.getByTestId('bento-tile-doctors').locator('[data-testid="doctor-card"]')
    const count = await cards.count()
    if (count > 0) {
      await cards.first().click()
      await expect(page).toHaveURL(/\/contacts/)
    }
  })

  // ─── Activity Chart Tile ──────────────────────────────────────────────────

  test('TC-BENTO-21 — activity chart tile renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('bento-tile-activity-chart')).toBeVisible()
  })

  test('TC-BENTO-22 — activity chart tile contains SVG sparkline', async ({ page }) => {
    await page.goto('/')
    const svg = page.getByTestId('bento-tile-activity-chart').locator('svg')
    await expect(svg).toBeVisible()
  })

  // ─── Quick Actions Tile ───────────────────────────────────────────────────

  test('TC-BENTO-23 — quick actions tile renders with 3 buttons', async ({ page }) => {
    await page.goto('/')
    const buttons = page.getByTestId('bento-tile-quick-actions').getByRole('button')
    await expect(buttons).toHaveCount(3)
  })

  test('TC-BENTO-24 — Upload Document button opens upload dialog', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('bento-tile-quick-actions').getByRole('button', { name: /upload document/i }).click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()
  })

  // ─── Responsive Layout ────────────────────────────────────────────────────

  test('TC-BENTO-25 — grid drops to 2 columns below 1280px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.goto('/')
    const columns = await page.getByTestId('bento-grid').evaluate(el =>
      getComputedStyle(el).gridTemplateColumns
    )
    expect(columns.split(' ').length).toBe(2)
  })

  // ─── Sidebar Preserved ───────────────────────────────────────────────────

  test('TC-BENTO-26 — existing sidebar renders alongside bento grid', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()
    await expect(page.getByTestId('bento-grid')).toBeVisible()
  })

  test('TC-BENTO-27 — sidebar is approximately 220px wide', async ({ page }) => {
    await page.goto('/')
    const box = await page.locator('[data-testid="sidebar"]').boundingBox()
    expect(box?.width).toBeCloseTo(220, -1)
  })

  // ─── Theme ───────────────────────────────────────────────────────────────

  test('TC-BENTO-28 — bento theme CSS variable --color-bg is #F5F5F7', async ({ page }) => {
    await page.goto('/')
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()
    )
    expect(bg).toBe('#F5F5F7')
  })

  test('TC-BENTO-29 — bento theme CSS variable --color-primary is #007AFF', async ({ page }) => {
    await page.goto('/')
    const primary = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()
    )
    expect(primary).toBe('#007AFF')
  })
})
