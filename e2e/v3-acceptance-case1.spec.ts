import { test, expect } from './fixtures'

const ECG_PDF = 'e2e/fixtures/ecg-invoice-london-clinic-dec2023.pdf'

/**
 * PRD §8.1 Case 1 — Single invoice upload, draft entities, accept flow.
 *
 * Fixture: ecg-invoice-london-clinic-dec2023.pdf
 *   → contact: Dr Sarah Chen (Cardiology)
 *   → clinic: The London Cardiac Centre
 *   → tags: ECG, Cardiology, invoice, 2023-11-23
 *   → appointment_suggestion: { date: '2023-11-23', type: 'Cardiology' }
 */
test.describe('Acceptance Case 1 — Single Invoice, Draft Entities, Accept Flow', () => {
  test('TC-AC1-01 — document row visible in list after upload', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(
      page.getByText(/ecg-invoice-london-clinic-dec2023/i),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('TC-AC1-02 — OCR-extracted tags visible in review step (ECG, Cardiology, invoice)', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: 'ECG' })).toBeVisible()
    await expect(pills.filter({ hasText: 'Cardiology' })).toBeVisible()
    await expect(pills.filter({ hasText: 'invoice' })).toBeVisible()
  })

  test('TC-AC1-03 — date tag extracted from document body visible', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: '2023-11-23' })).toBeVisible()
  })

  test('TC-AC1-04 — draft contact card visible with doctor name and specialty', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('contact-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Dr Sarah Chen')
    await expect(card).toContainText(/Cardiology/i)
  })

  test('TC-AC1-05 — draft clinic card visible with clinic name', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('clinic-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText(/London Cardiac Centre/i)
  })

  test('TC-AC1-06 — appointment suggestion banner visible with extracted date after upload', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await expect(banner).toContainText('2023-11-23')
    await expect(banner).toContainText(/Cardiology/i)
  })

  test('TC-AC1-07 — accepting appointment suggestion creates appointment record', async ({
    page,
  }) => {
    await page.goto('/appointments')
    const initialCount = await page.getByTestId('appointment-card').count()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await banner.getByRole('button', { name: /create appointment/i }).click()
    await expect(banner).not.toBeVisible({ timeout: 8_000 })

    await page.goto('/appointments')
    const finalCount = await page.getByTestId('appointment-card').count()
    expect(finalCount).toBeGreaterThan(initialCount)
  })

  test('TC-AC1-08 — accepting draft contact creates contact record', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    await page.getByTestId('contact-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await page.goto('/contacts')
    await expect(page.getByText('Dr Sarah Chen')).toBeVisible({ timeout: 10_000 })
  })

  test('TC-AC1-09 — dismissing draft contact does not create contact', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    await page.getByTestId('contact-suggestion-dismiss').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await page.goto('/contacts')
    await expect(page.getByText('Dr Sarah Chen')).not.toBeVisible()
  })
})
