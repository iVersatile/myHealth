import { test, expect } from './fixtures'

const SKIN_PDF = 'e2e/fixtures/skin-invoice-2023.pdf'
const NEURO_PDF = 'e2e/fixtures/neurology-scan-letter-nov2019.pdf'
const GYNAEC_PDF = 'e2e/fixtures/gynaecology-invoice-2023.pdf'

/**
 * PRD §8.3 Case 3 — Batch upload: Dermatology, Neurology, Gynaecology docs.
 *
 * skin-invoice-2023.pdf
 *   → contact: none
 *   → clinic: ClearSkin Dermatology Clinic
 *   → tags: Dermatology, invoice, 2023-07-10
 *   → appointment_suggestion: { date: '2023-07-10', type: 'Dermatology' }
 *
 * neurology-scan-letter-nov2019.pdf
 *   → contact: none
 *   → clinic: National Hospital for Neurology
 *   → tags: Neurology, referral, 2019-11-21
 *   → appointment_suggestion: null
 *
 * gynaecology-invoice-2023.pdf
 *   → contact: Dr Helen Moore (Gynaecology)
 *   → clinic: Women's Health London
 *   → tags: Gynaecology, invoice, 2023-04-05
 *   → appointment_suggestion: { date: '2023-04-05', type: 'Gynaecology' }
 */
test.describe('Acceptance Case 3 — Dermatology / Neurology / Gynaecology', () => {
  // ── Dermatology ─────────────────────────────────────────────────────────

  test('TC-AC3-01 — skin document row visible in list after upload', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(SKIN_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByText(/skin-invoice-2023/i)).toBeVisible({ timeout: 10_000 })
  })

  test('TC-AC3-02 — skin tags Dermatology / invoice / 2023-07-10 in review step', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(SKIN_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: 'Dermatology' })).toBeVisible()
    await expect(pills.filter({ hasText: 'invoice' })).toBeVisible()
    await expect(pills.filter({ hasText: '2023-07-10' })).toBeVisible()
  })

  test('TC-AC3-03 — skin clinic card shows ClearSkin Dermatology Clinic', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(SKIN_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('clinic-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText(/ClearSkin Dermatology Clinic/i)
  })

  test('TC-AC3-04 — skin has no contact suggestion card (no doctor extracted)', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(SKIN_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    await expect(page.getByTestId('contact-suggestion-card')).not.toBeVisible()
  })

  test('TC-AC3-05 — skin appointment banner shows 2023-07-10 / Dermatology after upload', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(SKIN_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await expect(banner).toContainText('2023-07-10')
    await expect(banner).toContainText(/Dermatology/i)
  })

  test('TC-AC3-06 — accepting skin clinic creates clinic record', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(SKIN_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    await page.getByTestId('clinic-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await page.goto('/clinics')
    await expect(page.getByText(/ClearSkin Dermatology Clinic/i)).toBeVisible({ timeout: 10_000 })
  })

  // ── Neurology ────────────────────────────────────────────────────────────

  test('TC-AC3-07 — neurology tags Neurology / referral / 2019-11-21 in review step', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(NEURO_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: 'Neurology' })).toBeVisible()
    await expect(pills.filter({ hasText: 'referral' })).toBeVisible()
    await expect(pills.filter({ hasText: '2019-11-21' })).toBeVisible()
  })

  test('TC-AC3-08 — neurology clinic card shows National Hospital for Neurology', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(NEURO_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('clinic-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText(/National Hospital for Neurology/i)
  })

  test('TC-AC3-09 — neurology has no appointment suggestion (null in mock)', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(NEURO_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByTestId('appt-suggestion-banner')).not.toBeVisible({ timeout: 5_000 })
  })

  // ── Gynaecology ──────────────────────────────────────────────────────────

  test('TC-AC3-10 — gynaecology contact suggestion Dr Helen Moore visible in review step', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GYNAEC_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('contact-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText(/Dr Helen Moore/i)
  })

  test('TC-AC3-11 — gynaecology tags Gynaecology / invoice / 2023-04-05 in review step', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GYNAEC_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: 'Gynaecology' })).toBeVisible()
    await expect(pills.filter({ hasText: 'invoice' })).toBeVisible()
    await expect(pills.filter({ hasText: '2023-04-05' })).toBeVisible()
  })

  test('TC-AC3-12 — gynaecology appointment banner shows 2023-04-05 / Gynaecology', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GYNAEC_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await expect(banner).toContainText('2023-04-05')
    await expect(banner).toContainText(/Gynaecology/i)
  })

  // ── Batch ────────────────────────────────────────────────────────────────

  test('TC-AC3-13 — uploading all 3 in sequence yields ≥3 new document rows', async ({
    page,
  }) => {
    await page.goto('/documents')
    const initialCount = await page.getByTestId('document-card').count()

    for (const pdf of [SKIN_PDF, NEURO_PDF, GYNAEC_PDF]) {
      await page.getByRole('button', { name: /upload/i }).click()
      await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(pdf)
      await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
      await page.getByRole('button', { name: /confirm upload/i }).click()
      await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
        timeout: 10_000,
      })
    }

    const finalCount = await page.getByTestId('document-card').count()
    expect(finalCount).toBeGreaterThanOrEqual(initialCount + 3)
  })
})
