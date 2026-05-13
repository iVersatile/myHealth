import { test, expect } from './fixtures'

const GP_NOTES_FIXTURE = 'e2e/fixtures/gp-notes-dr-sharma-2023.pdf'

test.describe('Clinical notes auto-extraction — upload review step', () => {
  test('TC-CLIN-01 — notes textarea pre-filled from Impression section', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').first().setInputFiles(GP_NOTES_FIXTURE)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const textarea = page.getByTestId('notes-textarea')
    await expect(textarea).toHaveValue('Likely iron-deficiency anaemia. FBC requested.')
  })

  test('TC-CLIN-02 — pre-filled notes not overwritten when user edits', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').first().setInputFiles(GP_NOTES_FIXTURE)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const textarea = page.getByTestId('notes-textarea')
    await expect(textarea).toHaveValue('Likely iron-deficiency anaemia. FBC requested.')

    await textarea.fill('My own note')
    await expect(textarea).toHaveValue('My own note')
  })
})
