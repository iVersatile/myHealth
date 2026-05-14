import { test, expect } from './fixtures'

const PHYSIO_MOCK_PDF = 'src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf'

test.describe('V3-F2 — Contact Extraction with UK Mobile Phone', () => {
  test('TC-F2-01 — contact suggestion card shows name, UK mobile phone, and email', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const card = page.getByTestId('contact-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('John Green')
    await expect(card).toContainText('07544 370440')
    await expect(card).toContainText('jg@johngreenphysio.com')
  })

  test('TC-F2-02 — saving contact suggestion creates a new contact', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    await page.getByTestId('contact-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/contacts')
    const contact = page.getByText('John Green')
    await expect(contact).toBeVisible()
    await contact.click()
    await expect(page.getByText('07544 370440')).toBeVisible()
    await expect(page.getByText('jg@johngreenphysio.com')).toBeVisible()
  })

  test('TC-F2-03 — UK mobile number in 07XXX XXXXXX format is extracted', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const phoneField = page.getByTestId('contact-suggestion-phone')
    await expect(phoneField).toHaveValue('07544 370440')
  })

  test('TC-F2-04 — no duplicate contact created if contact already exists', async ({ page }) => {
    await page.goto('/contacts')
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByLabel(/name/i).fill('John Green')
    await page.getByRole('button', { name: /save/i }).click()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    await expect(page.getByTestId('contact-suggestion-merge')).toBeVisible()
  })

  test('TC-F2-05 — dismissing contact suggestion does not create contact', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    await page.getByTestId('contact-suggestion-dismiss').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/contacts')
    await expect(page.getByText('John Green')).not.toBeVisible()
  })
})
