import { test, expect } from './fixtures'

const INTL_PHONE_PDF =
  'src-tauri/tests/fixtures/DrSmith_intl_phone_2024-03-10.pdf'

test.describe('Upload — contact suggestion card', () => {
  test('TC-UPCS-01 — international phone +1 (555) 123-4567 appears in contact suggestion card', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(INTL_PHONE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const card = page.getByTestId('contact-suggestion-card')
    await expect(card).toBeVisible()

    const phone = page.getByTestId('contact-suggestion-phone')
    await expect(phone).toContainText('+1 (555) 123-4567')
  })
})
