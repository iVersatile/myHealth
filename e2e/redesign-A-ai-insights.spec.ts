import { test, expect } from './fixtures'

const PHYSIO_PDF = 'src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf'

test.describe('Redesign-A — AiInsightsPanel', () => {
  // Sanity: documents page loads (precondition for all integration tests below)
  test('TC-RAAI-00 — documents page loads', async ({ page }) => {
    await page.goto('/documents')
    await expect(page.locator('[data-testid="upload-btn"]').or(page.getByRole('button', { name: /upload/i }))).toBeVisible()
  })

  // Gated on Phase 55 integration: AiInsightsPanel wired into DocumentPreviewPanel or detail page
  test.skip('TC-RAAI-01 — selecting a document shows ai-insights-panel', async ({ page }) => {
    await page.goto('/documents')

    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await page.waitForSelector('[data-testid="document-card"]')

    await page.getByTestId('document-card').first().click()

    await expect(page.getByTestId('ai-insights-panel')).toBeVisible()
  })

  // Gated on Phase 55 integration: at least one section renders inside the panel
  test.skip('TC-RAAI-02 — ai-insights-panel renders at least one section', async ({ page }) => {
    await page.goto('/documents')

    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await page.waitForSelector('[data-testid="document-card"]')

    await page.getByTestId('document-card').first().click()

    const panel = page.getByTestId('ai-insights-panel')
    await expect(panel).toBeVisible()
    await expect(panel.getByText(/summary/i)).toBeVisible()
  })

  // Gated on Phase 55 integration: collapse toggle hides panel body
  test.skip('TC-RAAI-03 — ai-insights-panel collapses on header click', async ({ page }) => {
    await page.goto('/documents')

    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await page.waitForSelector('[data-testid="document-card"]')

    await page.getByTestId('document-card').first().click()

    const panel = page.getByTestId('ai-insights-panel')
    await expect(panel).toBeVisible()

    await panel.getByRole('button', { name: /ai insights/i }).click()
    await expect(panel.getByText(/no summary available/i)).not.toBeVisible()
  })
})
