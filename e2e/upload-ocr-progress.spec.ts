import { test, expect } from '@playwright/test'

const SCANNED_PDF = 'src-tauri/tests/fixtures/two-page-scanned.pdf'

test.describe('OCR Progress Bar — scanned PDF upload', () => {
  test('TC-OCR-01 — progress bar shows page 1 of 2 then page 2 of 2, then review step with non-empty content', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(SCANNED_PDF)

    // Analysing step must appear
    await expect(page.getByText('Analysing…')).toBeVisible({ timeout: 15_000 })

    // OCR progress bar must appear (confirms OCR path was taken)
    const progressbar = page.getByRole('progressbar', { name: 'OCR progress' })
    await expect(progressbar).toBeVisible({ timeout: 30_000 })

    // Page 1 of 2 label
    await expect(page.getByText(/page 1 of 2/i)).toBeVisible({ timeout: 30_000 })

    // Page 2 of 2 label (advances when page 1 finishes)
    await expect(page.getByText(/page 2 of 2/i)).toBeVisible({ timeout: 60_000 })

    // Progress bar disappears once OCR completes
    await expect(progressbar).not.toBeVisible({ timeout: 60_000 })

    // Review step must appear
    await expect(page.getByTestId('upload-review-step')).toBeVisible({ timeout: 10_000 })

    // Extracted text must be non-empty — at least one tag chip present
    const tagChips = page.getByTestId('tag-chip')
    await expect(tagChips.first()).toBeVisible({ timeout: 5_000 })
  })
})
