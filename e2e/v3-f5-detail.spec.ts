import { test, expect } from './fixtures'

const SAMPLE_PDF = 'src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf'

test.describe('V3-F5 — Activity Date editing on Document Detail', () => {
  test('TC-V3-F5-D01 — detail page pre-populates activity_date from extracted PDF date', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    const card = page.getByTestId('document-card').first()
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.getByRole('link', { name: /view/i }).click()

    const dateInput = page.getByTestId('detail-activity-date-input')
    await expect(dateInput).toBeVisible()
    await expect(dateInput).toHaveValue('2023-03-09')
  })

  test('TC-V3-F5-D02 — saving a new activity_date shows confirmation tick', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    const card = page.getByTestId('document-card').first()
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.getByRole('link', { name: /view/i }).click()

    const dateInput = page.getByTestId('detail-activity-date-input')
    await dateInput.fill('2023-07-15')

    const saveBtn = page.getByTestId('detail-activity-date-save')
    await saveBtn.click()

    await expect(saveBtn).toContainText('✓', { timeout: 5_000 })
  })

  test('TC-V3-F5-D03 — updated activity_date appears in timeline', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    const card = page.getByTestId('document-card').first()
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.getByRole('link', { name: /view/i }).click()

    const dateInput = page.getByTestId('detail-activity-date-input')
    await dateInput.fill('2023-07-15')
    const saveBtn = page.getByTestId('detail-activity-date-save')
    await saveBtn.click()
    await expect(saveBtn).toContainText('✓', { timeout: 5_000 })

    await page.goto('/timeline')
    const entry = page.getByTestId('timeline-entry').first()
    await expect(entry).toContainText('2023-07-15')
  })
})
