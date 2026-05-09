import { test, expect } from './fixtures'

const PHYSIO_MOCK_PDF = 'src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf'
const NO_DATE_PHYSIO_PDF = 'src-tauri/tests/fixtures/no-date-physio.pdf'
const NO_DATE_NO_FILENAME_PDF = 'src-tauri/tests/fixtures/no-date-no-filename.pdf'

test.describe('V3-F5 — Timeline Activity Date', () => {
  test('TC-V3-F5-01 — timeline entry date is the service date extracted from PDF body', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const dateField = page.getByTestId('activity-date-field')
    await expect(dateField).toHaveValue('2023-03-09')
  })

  test('TC-V3-F5-02 — timeline entry falls back to filename date when PDF body has no service date', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(NO_DATE_PHYSIO_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const dateField = page.getByTestId('activity-date-field')
    await expect(dateField).toHaveValue('2023-03-09')
  })

  test('TC-V3-F5-03 — timeline entry falls back to upload date when neither PDF body nor filename has a date', async ({ page }) => {
    const dateStr = new Date().toISOString().slice(0, 10)

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(NO_DATE_NO_FILENAME_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const dateField = page.getByTestId('activity-date-field')
    await expect(dateField).toHaveValue(dateStr)
  })

  test('TC-V3-F5-04 — timeline entry description format is "{date} {SPECIALTY} with {Title} {Provider}"', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByTestId('contact-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/timeline')
    const entry = page.getByTestId('timeline-entry').first()
    await expect(entry).toContainText('2023-03-09 PHYSIOTHERAPY with Mr John Green')
  })

  test('TC-V3-F5-05 — user can override the extracted activity date before saving', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const dateField = page.getByTestId('activity-date-field')
    await dateField.fill('2023-03-15')
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/timeline')
    const entry = page.getByTestId('timeline-entry').first()
    await expect(entry).toContainText('2023-03-15')
  })
})
