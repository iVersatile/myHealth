import { test, expect } from './fixtures'

const GP_PDF = 'e2e/fixtures/gp-notes-dr-sharma-2023.pdf'

/**
 * PRD §8.2 Case 2 — GP notes upload, existing contact no-dup, draft clinic, accept appointment.
 *
 * Fixture: gp-notes-dr-sharma-2023.pdf
 *   → contact: Dr Priya Sharma (General Practice) — pre-seeded; should NOT produce draft card
 *   → clinic: Riverside Medical Practice
 *   → tags: GP notes, General Practice, 2023-09-15
 *   → appointment_suggestion: { date: '2023-09-15', type: 'General Practice' }
 */
test.describe('Acceptance Case 2 — GP Notes, Existing Contact No-Dup, Draft Clinic', () => {
  test('TC-AC2-01 — document row visible in list after upload', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByText(/gp-notes-dr-sharma-2023/i)).toBeVisible({ timeout: 10_000 })
  })

  test('TC-AC2-02 — GP notes and General Practice tags visible in review step', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: 'GP notes' })).toBeVisible()
    await expect(pills.filter({ hasText: 'General Practice' })).toBeVisible()
  })

  test('TC-AC2-03 — date tag 2023-09-15 extracted from document body', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: '2023-09-15' })).toBeVisible()
  })

  test('TC-AC2-04 — DoctorSuggestionBanner suppressed when Dr Priya Sharma already exists', async ({
    page,
  }) => {
    // Pre-seed the contact via the first upload's review-step save
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByTestId('contact-suggestion-save').click()
    await expect(page.getByTestId('contact-suggestion-save')).toContainText(/saved/i, { timeout: 5_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    // Second upload — contacts_find_similar returns the existing contact,
    // so DoctorSuggestionBanner must NOT render
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    await expect(page.getByTestId('doctor-suggestion-banner')).not.toBeVisible({ timeout: 5_000 })
  })

  test('TC-AC2-05 — draft clinic card visible with Riverside Medical Practice', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('clinic-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText(/Riverside Medical Practice/i)
  })

  test('TC-AC2-06 — appointment suggestion banner visible with date 2023-09-15', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await expect(banner).toContainText('2023-09-15')
    await expect(banner).toContainText(/General Practice/i)
  })

  test('TC-AC2-07 — accepting appointment suggestion creates appointment record', async ({
    page,
  }) => {
    await page.goto('/appointments')
    const initialCount = await page.getByTestId('appointment-card').count()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
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

  test('TC-AC2-08 — accepting draft clinic creates clinic record', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    await page.getByTestId('clinic-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await page.goto('/clinics')
    await expect(page.getByText(/Riverside Medical Practice/i)).toBeVisible({ timeout: 10_000 })
  })

  test('TC-AC2-09 — dismissing draft clinic does not create clinic record', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    await page.getByTestId('clinic-suggestion-dismiss').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await page.goto('/clinics')
    await expect(page.getByText(/Riverside Medical Practice/i)).not.toBeVisible()
  })
})
