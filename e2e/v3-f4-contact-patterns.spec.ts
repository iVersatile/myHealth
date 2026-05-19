import { test, expect } from './fixtures'

const ALLCAPS_PDF = 'src-tauri/tests/fixtures/allcaps-surname-2023-06-01.pdf'
const GP_LABEL_PDF = 'src-tauri/tests/fixtures/gp-labelled-sharma-2023-06-01.pdf'

test.describe('Upload — contact extraction patterns', () => {
  test('TC-F4CP-01 — ALLCAPS surname is normalised to title-case in suggestion', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').first().setInputFiles(ALLCAPS_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const card = page.getByTestId('contact-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Mary Margaret Murphy')
  })

  test('TC-F4CP-02 — role-label prefix name is normalised in suggestion', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').first().setInputFiles(GP_LABEL_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const card = page.getByTestId('contact-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Vaibhav Sharma')
  })
})
