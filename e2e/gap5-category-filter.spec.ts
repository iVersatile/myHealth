import { test, expect } from './fixtures'

const WITH_CATEGORY = 'src-tauri/tests/fixtures/medical-invoice.pdf'
const WITHOUT_CATEGORY = 'src-tauri/tests/fixtures/no-date-no-filename.pdf'

async function uploadDoc(
  page: import('@playwright/test').Page,
  file: string,
  acceptCategory = false,
) {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  await page.locator('input[type="file"]').setInputFiles(file)
  await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
  if (acceptCategory) {
    const banner = page.getByTestId('category-suggestion-banner')
    if (await banner.isVisible()) {
      await page.getByTestId('category-suggestion-accept').click()
    }
  }
  await page.getByRole('button', { name: /confirm upload/i }).click()
  await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('document-card').first()).toBeVisible({ timeout: 10_000 })
}

test.describe('Gap 5 — Category multi-select filter', () => {
  test('TC-GAP5-01 — filter by Physiotherapy shows only categorised doc', async ({ page }) => {
    // Upload doc A with Physiotherapy category
    await uploadDoc(page, WITH_CATEGORY, true)

    // Upload doc B without category (no-date-no-filename has no category_suggestion)
    await uploadDoc(page, WITHOUT_CATEGORY, false)

    await page.goto('/documents')

    // Both docs visible initially
    await expect(page.getByTestId('document-card')).toHaveCount(2, { timeout: 10_000 })

    // Physiotherapy chip should be visible in filter bar
    const chip = page.getByRole('button', { name: 'Physiotherapy' })
    await expect(chip).toBeVisible({ timeout: 5_000 })

    // Click the chip to filter
    await chip.click()

    // Only categorised doc should appear
    await expect(page.getByTestId('document-card')).toHaveCount(1, { timeout: 5_000 })

    // Clear filter
    await page.getByRole('button', { name: /clear/i }).click()

    // Both docs visible again
    await expect(page.getByTestId('document-card')).toHaveCount(2, { timeout: 5_000 })
  })
})
