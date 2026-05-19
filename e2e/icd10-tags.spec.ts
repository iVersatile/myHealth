import { test, expect } from './fixtures'

const SAMPLE_PDF = 'src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf'

test.describe('Phase 105 — ICD-10 code tags on document detail', () => {
  test('TC-ICD10-01 — icd10-section hidden when document has no tags', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    const card = page.getByTestId('document-card').first()
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.getByRole('link', { name: /view/i }).click()

    await expect(page.getByTestId('icd10-section')).not.toBeVisible()
  })

  test('TC-ICD10-02 — icd10-section shows chips when tags are seeded', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    const card = page.getByTestId('document-card').first()
    await expect(card).toBeVisible({ timeout: 10_000 })

    const viewLink = card.getByRole('link', { name: /view/i })
    const href = await viewLink.getAttribute('href')
    const documentId = href?.split('/').pop() ?? ''

    // Seed ICD-10 tags via mock before navigating to detail
    await page.evaluate(
      async ({ docId }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (window as any).__TAURI__.core.invoke('__seed_icd10_tags', {
          documentId: docId,
          tags: [
            { code: 'M54.5', description: 'Low back pain', confidence: 0.95 },
            { code: 'Z96.641', description: 'Presence of prosthetic joint', confidence: 0.8 },
          ],
        })
      },
      { docId: documentId }
    )

    await viewLink.click()

    await expect(page.getByTestId('icd10-section')).toBeVisible({ timeout: 5_000 })
    const chips = page.getByTestId('icd10-tag')
    await expect(chips).toHaveCount(2)
    await expect(chips.first()).toContainText('M54.5')
  })
})
