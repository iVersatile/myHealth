import { test, expect } from './fixtures'

const FIXTURE = 'src-tauri/tests/fixtures/clinic-phone-email-2024.pdf'

test.describe('Upload — clinic suggestion phone + email display', () => {
  test('TC-CLPH-01 — clinic suggestion card shows phone number', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const phone = page.getByTestId('clinic-suggestion-phone')
    await expect(phone).toContainText('020 3974 0950')
  })

  test('TC-CLPH-02 — clinic suggestion card shows email address', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const email = page.getByTestId('clinic-suggestion-email')
    await expect(email).toContainText('info@evewell.com')
  })
})
