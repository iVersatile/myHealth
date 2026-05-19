import { test, expect } from './fixtures'

const FIXTURE_PDF = 'src-tauri/tests/fixtures/medical-invoice.pdf'

async function uploadAndNavigateToDetail(page: import('@playwright/test').Page) {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  await page.locator('input[type="file"]').setInputFiles(FIXTURE_PDF)
  await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
  await page.getByRole('button', { name: /confirm upload/i }).click()
  await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

  const card = page.getByTestId('document-card').first()
  await expect(card).toBeVisible({ timeout: 10_000 })
  await card.getByRole('link', { name: /view/i }).click()
  await expect(page.locator('text=Loading')).not.toBeVisible({ timeout: 10_000 })
}

test.describe('PDF export — document detail (Phase 50)', () => {
  test('TC-PDF-01 — export-report-btn visible on document detail page', async ({ page }) => {
    await uploadAndNavigateToDetail(page)
    await expect(page.getByTestId('export-report-btn')).toBeVisible()
  })

  test('TC-PDF-02 — clicking export-report-btn triggers file download', async ({ page }) => {
    await uploadAndNavigateToDetail(page)
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByTestId('export-report-btn').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/_report\.pdf$/)
  })
})
