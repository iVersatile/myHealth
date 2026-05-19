import { test, expect } from './fixtures'

const INVOICE_PDF = 'src-tauri/tests/fixtures/medical-invoice.pdf'
const NO_SUGGESTION_PDF = 'src-tauri/tests/fixtures/BloodTest_2024-01-15.pdf'

/**
 * V3-F6 — Auto-create appointment suggestion from invoice upload
 *
 * Fixture: medical-invoice.pdf
 *   → appointment_suggestion: { date: '2024-01-15', type: 'Physiotherapy' }
 *   → contact: Dr Sarah Mitchell
 *   → clinic: Hartfield Physiotherapy Clinic
 *
 * Fixture: BloodTest_2024-01-15.pdf
 *   → appointment_suggestion: null
 *
 * Test IDs: TC-F6-01 … TC-F6-04
 */
test.describe('V3-F6 — Appointment Suggestion Banner', () => {
  test('TC-F6-01 — appt-suggestion-banner appears after uploading an invoice with provider', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(INVOICE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
  })

  test('TC-F6-02 — banner shows extracted date and title', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(INVOICE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })

    await expect(banner).toContainText('2024-01-15')
    await expect(banner).toContainText(/Physiotherapy/i)
  })

  test('TC-F6-03 — accepting suggestion creates an appointment record', async ({ page }) => {
    await page.goto('/appointments')
    const initialCount = await page.getByTestId('appointment-card').count()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(INVOICE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await banner.getByRole('button', { name: /create appointment/i }).click()
    await expect(banner).not.toBeVisible({ timeout: 8_000 })

    await page.goto('/appointments')
    const finalCount = await page.getByTestId('appointment-card').count()
    expect(finalCount).toBeGreaterThan(initialCount)
  })

  test('TC-F6-04 — no banner appears when document has no appointment suggestion', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(NO_SUGGESTION_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByTestId('appt-suggestion-banner')).not.toBeVisible({ timeout: 5_000 })
  })
})
