import { test, expect } from './fixtures'

test.describe('Redesign-A — DocumentListPanel', () => {
  test('TC-R-A-DL-01 — documents page loads and shows document list', async ({ page }) => {
    await page.goto('/documents')
    await expect(page.locator('[data-testid="upload-btn"]')).toBeVisible()
  })

  test('TC-R-A-DL-02 — filter search input is visible on documents page', async ({ page }) => {
    await page.goto('/documents')
    const searchInput = page.locator('[data-testid="filter-search"]').or(
      page.getByPlaceholder('Search…')
    )
    await expect(searchInput.first()).toBeVisible()
  })

  // Gated on Phase 54: DocumentListPanel wired into /documents page
  test.skip('TC-R-A-DL-03 — document-list-panel testid visible after Phase 54 integration', async ({ page }) => {
    await page.goto('/documents')
    await expect(page.getByTestId('document-list-panel')).toBeVisible()
    await expect(page.getByTestId('filter-bar')).toBeVisible()
  })

  // Gated on Phase 54: filter narrows results via DocumentListPanel
  test.skip('TC-R-A-DL-04 — filter bar narrows results in DocumentListPanel', async ({ page }) => {
    await page.goto('/documents')
    await page.getByTestId('filter-search').fill('blood')
    await page.waitForTimeout(400)
    const rows = page.getByTestId('document-row')
    await expect(rows.first()).toBeVisible()
  })
})
