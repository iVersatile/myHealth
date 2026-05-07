import { test, expect } from './fixtures'

const REAL_PDF = 'src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf'
const NO_DATE_NO_FILENAME_PDF = 'src-tauri/tests/fixtures/no-date-no-filename.pdf'

test.describe('Phase 21 — Tag prefix removal, By Uploaded Date view, activity_date editing', () => {
  test('TC-21-01 — title tag stored without "title:" prefix on upload review', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(REAL_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const tagChips = page.getByTestId('tag-chip')
    const allTags = await tagChips.allTextContents()
    const tagTexts = allTags.map((t) => t.trim())

    const hasTitlePrefix = tagTexts.some((t) => t.startsWith('title:'))
    expect(hasTitlePrefix).toBe(false)
  })

  test('TC-21-02 — title tag stored without "title:" prefix after save', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(REAL_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/documents')
    await page.getByTestId('document-card').first().click()

    const tagChips = page.getByTestId('tag-chip')
    const allTags = await tagChips.allTextContents()
    const tagTexts = allTags.map((t) => t.trim())

    const hasTitlePrefix = tagTexts.some((t) => t.startsWith('title:'))
    expect(hasTitlePrefix).toBe(false)
  })

  test('TC-21-03 — "By Uploaded Date" tab exists in Timeline', async ({ page }) => {
    await page.goto('/timeline')
    await expect(page.getByRole('button', { name: /by uploaded date/i })).toBeVisible()
  })

  test('TC-21-04 — "By Uploaded Date" view shows uploaded document entries', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(REAL_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/timeline')
    await page.getByRole('button', { name: /by uploaded date/i }).click()

    await expect(page.getByTestId('timeline-entry').first()).toBeVisible()
  })

  test('TC-21-05 — Chronological view excludes upload-only events (no activity_date)', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(NO_DATE_NO_FILENAME_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const dateField = page.getByTestId('activity-date-field')
    await dateField.fill('')
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/timeline')
    const chronoButton = page.getByRole('button', { name: /chronological/i })
    await chronoButton.click()

    const entries = page.getByTestId('timeline-entry')
    const count = await entries.count()
    for (let i = 0; i < count; i++) {
      await expect(entries.nth(i)).not.toContainText('Uploaded:')
    }
  })

  test('TC-21-06 — document detail page shows Activity Date input field', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(NO_DATE_NO_FILENAME_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const dateField = page.getByTestId('activity-date-field')
    await dateField.fill('')
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/documents')
    await page.getByTestId('document-card').first().click()

    await expect(page.getByTestId('detail-activity-date-input')).toBeVisible()
    await expect(page.getByTestId('detail-activity-date-save')).toBeVisible()
  })

  test('TC-21-07 — user can set and persist activity_date from document detail page', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(NO_DATE_NO_FILENAME_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const dateField = page.getByTestId('activity-date-field')
    await dateField.fill('')
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/documents')
    await page.getByTestId('document-card').first().click()

    const activityInput = page.getByTestId('detail-activity-date-input')
    await activityInput.fill('2024-06-15')
    await page.getByTestId('detail-activity-date-save').click()
    await expect(page.getByTestId('detail-activity-date-save')).toContainText('✓')

    await page.reload()
    await expect(page.getByTestId('detail-activity-date-input')).toHaveValue('2024-06-15')
  })

  test('TC-21-08 — after setting activity_date, document appears in Chronological timeline', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(NO_DATE_NO_FILENAME_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const dateField = page.getByTestId('activity-date-field')
    await dateField.fill('')
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/documents')
    await page.getByTestId('document-card').first().click()

    await page.getByTestId('detail-activity-date-input').fill('2024-06-15')
    await page.getByTestId('detail-activity-date-save').click()
    await expect(page.getByTestId('detail-activity-date-save')).toContainText('✓')

    await page.goto('/timeline')
    await page.getByRole('button', { name: /chronological/i }).click()

    await expect(page.getByTestId('timeline-entry').first()).toContainText('2024-06-15')
  })
})
