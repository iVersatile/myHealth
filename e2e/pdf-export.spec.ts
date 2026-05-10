import { test, expect } from './fixtures'

test.describe('Phase 50 — PDF Summary Report Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/documents')
    // Navigate to a document detail page
    const firstDoc = page.locator('[data-testid="document-row"]').first()
    await firstDoc.click()
  })

  test('TC-50-01 — export-report-btn is visible on document detail page', async ({ page }) => {
    await expect(page.locator('[data-testid="export-report-btn"]')).toBeVisible()
  })

  test('TC-50-02 — clicking export-report-btn triggers file download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download')
    await page.locator('[data-testid="export-report-btn"]').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })

  test('TC-50-03 — export button is disabled while generating', async ({ page }) => {
    await page.locator('[data-testid="export-report-btn"]').click()
    await expect(page.locator('[data-testid="export-report-btn"]')).toBeDisabled()
  })
})
