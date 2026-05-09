import { test, expect } from './fixtures'

const PHYSIO_MOCK_PDF = 'src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf'

test.describe('V3-F4 — Tag Auto-Extraction', () => {
  test('TC-V3-F4-01 — all four tags pre-populated: document type, provider, specialty, activity date', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const tagChips = page.getByTestId('tag-chip')
    const allTags = await tagChips.allTextContents()
    const tagSet = allTags.map((t) => t.trim().toLowerCase())

    expect(tagSet).toContain('invoice')
    expect(tagSet).toContain('mr john green')
    expect(tagSet).toContain('physiotherapy')
    expect(tagSet).toContain('2023-03-09')
  })

  test('TC-V3-F4-02 — auto-extracted tags are persisted with saved document', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/documents')
    await page.getByTestId('document-card').first().click()

    const tagChips = page.getByTestId('tag-chip')
    const allTags = await tagChips.allTextContents()
    const tagSet = allTags.map((t) => t.trim().toLowerCase())

    expect(tagSet).toContain('invoice')
    expect(tagSet).toContain('mr john green')
    expect(tagSet).toContain('physiotherapy')
    expect(tagSet).toContain('2023-03-09')
  })

  test('TC-V3-F4-03 — user can remove an auto-extracted tag and add a custom tag before saving', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    await page.getByTestId('tag-chip').filter({ hasText: 'invoice' }).getByRole('button', { name: /remove/i }).click()

    await page.getByTestId('tag-input').fill('custom-tag')
    await page.keyboard.press('Enter')

    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/documents')
    await page.getByTestId('document-card').first().click()

    const tagChips = page.getByTestId('tag-chip')
    const allTags = await tagChips.allTextContents()
    const tagSet = allTags.map((t) => t.trim().toLowerCase())

    expect(tagSet).not.toContain('invoice')
    expect(tagSet).toContain('custom-tag')
  })
})
