import { test, expect } from './fixtures'

const MEDICAL_INVOICE = 'src-tauri/tests/fixtures/medical-invoice.pdf'

test.describe('Gap 1 — Extracted Text section on document detail', () => {
  test('TC-GAP1-01 — detail-extracted-text element is in DOM after uploading a PDF with OCR text', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(MEDICAL_INVOICE)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    const card = page.getByTestId('document-card').first()
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.getByRole('link', { name: /view/i }).click()

    await expect(page.locator('text=Loading')).not.toBeVisible({ timeout: 10_000 })

    const section = page.getByTestId('detail-extracted-text')
    await expect(section).toBeAttached()
    await expect(section.locator('summary')).toHaveText('Extracted Text')
  })
})
