import { test, expect } from './fixtures'

const WITH_PREVIEW = 'src-tauri/tests/fixtures/medical-invoice.pdf'
const WITHOUT_PREVIEW = 'src-tauri/tests/fixtures/no-date-physio.pdf'

test.describe('OCR Extracted Text Preview — upload review step', () => {
  test('TC-OCRPREV-01 — preview block visible when extracted text exists', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(WITH_PREVIEW)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const preview = page.getByTestId('upload-extracted-text-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText('Hartfield Physiotherapy Clinic')
  })

  test('TC-OCRPREV-02 — preview block absent when no extracted text', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(WITHOUT_PREVIEW)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    await expect(page.getByTestId('upload-extracted-text-preview')).not.toBeAttached()
  })
})
