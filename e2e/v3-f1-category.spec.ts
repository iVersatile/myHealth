import { test, expect } from './fixtures'

const PHYSIO_MOCK_PDF = 'src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf'

test.describe('V3-F1 — Category Auto-Creation', () => {
  test('TC-F1-01 — category suggestion banner shown for unknown specialty keyword', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const banner = page.getByTestId('category-suggestion-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('Physiotherapy')
  })

  test('TC-F1-02 — accepting category suggestion creates the category and assigns it', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    await page.getByTestId('category-suggestion-accept').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/documents')
    const doc = page.getByTestId('document-card').first()
    await expect(doc).toContainText('Physiotherapy')

    await page.goto('/settings/categories')
    await expect(page.getByText('Physiotherapy')).toBeVisible()
  })

  test('TC-F1-03 — dismissing category suggestion leaves document without that category', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    await page.getByTestId('category-suggestion-dismiss').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/settings/categories')
    await expect(page.getByText('Physiotherapy')).not.toBeVisible()
  })

  test('TC-F1-04 — no category suggestion banner when category already exists', async ({ page }) => {
    await page.goto('/settings/categories')
    await page.getByRole('button', { name: /add category/i }).click()
    await page.getByLabel(/name/i).fill('Physiotherapy')
    await page.getByRole('button', { name: /save/i }).click()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    await expect(page.getByTestId('category-suggestion-banner')).not.toBeVisible()
  })
})
