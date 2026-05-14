import { test, expect } from './fixtures'

const PHYSIO_PDF = 'src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf'

test.describe('Redesign-A — PDF Preview Panel', () => {
  test('TC-RAPDF-01 — selecting a document row opens the preview panel', async ({ page }) => {
    await page.goto('/documents')

    // Upload a PDF so there is at least one document in the list
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await page.waitForSelector('[data-testid="document-card"]')

    // Preview panel should not be visible before any row is clicked
    await expect(page.getByTestId('document-preview-panel')).not.toBeVisible()

    // Click the document card (not the checkbox)
    await page.getByTestId('document-card').first().click()

    // Preview panel should now be visible
    await expect(page.getByTestId('document-preview-panel')).toBeVisible()
  })

  test('TC-RAPDF-02 — preview panel shows iframe for PDF documents', async ({ page }) => {
    await page.goto('/documents')

    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await page.waitForSelector('[data-testid="document-card"]')

    await page.getByTestId('document-card').first().click()

    const panel = page.getByTestId('document-preview-panel')
    await expect(panel).toBeVisible()
    await expect(panel.getByTestId('preview-iframe')).toBeVisible()
  })

  test('TC-RAPDF-03 — list panel remains visible alongside preview panel', async ({ page }) => {
    await page.goto('/documents')

    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await page.waitForSelector('[data-testid="document-card"]')

    await page.getByTestId('document-card').first().click()

    await expect(page.getByTestId('document-list-panel')).toBeVisible()
    await expect(page.getByTestId('document-preview-panel')).toBeVisible()
  })
})
