import { test, expect } from './fixtures'

const ALLCAPS_PDF = 'src-tauri/tests/fixtures/allcaps-surname-2023-06-01.pdf'
const GP_LABELLED_PDF = 'src-tauri/tests/fixtures/gp-labelled-sharma-2023-06-01.pdf'
const LONDON_203_PDF = 'src-tauri/tests/fixtures/london-203-phone-2023-06-01.pdf'

test.describe('UTF-08 — Contact Extraction Edge Cases', () => {
  test('TC-UTF08-01 — ALLCAPS surname contact name appears in suggestion card', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(ALLCAPS_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const card = page.getByTestId('contact-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Mary Margaret MURPHY')
  })

  test('TC-UTF08-02 — ALLCAPS surname contact can be saved as a new contact', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(ALLCAPS_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    await page.getByTestId('contact-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/contacts')
    await expect(page.getByText('Mary Margaret MURPHY')).toBeVisible()
  })

  test('TC-UTF08-03 — GP-labelled contact name appears in suggestion card', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(GP_LABELLED_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const card = page.getByTestId('contact-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Vaibhav SHARMA')
  })

  test('TC-UTF08-04 — GP-labelled contact can be saved as a new contact', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(GP_LABELLED_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    await page.getByTestId('contact-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/contacts')
    await expect(page.getByText('Vaibhav SHARMA')).toBeVisible()
  })

  test('TC-UTF08-05 — London +44 (0) 203 phone format shown in suggestion card', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(LONDON_203_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const card = page.getByTestId('contact-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('+44 (0) 203 423 7500')
  })

  test('TC-UTF08-06 — London +44 (0) 203 phone is preserved when contact is saved', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(LONDON_203_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const phoneField = page.getByTestId('contact-suggestion-phone')
    await expect(phoneField).toHaveValue('+44 (0) 203 423 7500')

    await page.getByTestId('contact-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/contacts')
    const contact = page.getByText('Dr Jones')
    await expect(contact).toBeVisible()
    await contact.click()
    await expect(page.getByText('+44 (0) 203 423 7500')).toBeVisible()
  })
})
