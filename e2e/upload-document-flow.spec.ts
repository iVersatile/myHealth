import { test, expect } from '@playwright/test'

const FIXTURE_PDF = 'src-tauri/tests/fixtures/medical-invoice.pdf'

/**
 * E2E acceptance tests: Upload Document flow
 *
 * Fixture: medical-invoice.pdf
 *   - Contact suggestion:  Dr Sarah Mitchell
 *   - Clinic suggestion:   Hartfield Physiotherapy Clinic (CRN 5432109, W1G 0PU)
 *   - Appointment date:    15/01/2024 (Date of Service label)
 *   - Tags:                invoice (type), PHYSIOTHERAPY (specialty)
 *
 * TC-UPLOAD-01: Upload triggers clinic suggestion with CRN and address
 * TC-UPLOAD-02: Saving clinic suggestion creates clinic record
 * TC-UPLOAD-03: Upload triggers contact suggestion for Dr Sarah Mitchell
 * TC-UPLOAD-04: Saving contact suggestion creates contact record
 * TC-UPLOAD-05: Tags invoice and PHYSIOTHERAPY appear on the review step
 * TC-UPLOAD-06: Appointment suggestion banner appears after upload with 2024 date
 * TC-UPLOAD-07: Confirming appointment suggestion creates appointment record
 */
test.describe('Upload Document — full extraction flow', () => {
  test('TC-UPLOAD-01 — clinic suggestion card shows CRN and address', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('clinic-suggestion-card').first()
    await expect(card).toBeVisible()

    const crn = card.getByTestId('clinic-suggestion-reg-number')
    await expect(crn).toBeVisible()
    await expect(crn).toContainText('5432109')

    const address = card.getByTestId('clinic-address-item').first()
    await expect(address).toBeVisible()
  })

  test('TC-UPLOAD-02 — saving clinic suggestion creates a clinic record', async ({ page }) => {
    await page.goto('/clinics')
    const initialCount = await page.getByTestId('clinic-row').count()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('clinic-suggestion-card').first()
    await card.getByTestId('clinic-suggestion-save').click()

    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    await page.goto('/clinics')
    const finalCount = await page.getByTestId('clinic-row').count()
    expect(finalCount).toBeGreaterThan(initialCount)
  })

  test('TC-UPLOAD-03 — contact suggestion card shows Dr Sarah Mitchell with phone', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('contact-suggestion-card').first()
    await expect(card).toBeVisible()
    await expect(card).toContainText('Sarah Mitchell')

    const phone = card.getByTestId('contact-suggestion-phone')
    await expect(phone).toBeVisible()
    await expect(phone).toContainText('020')
  })

  test('TC-UPLOAD-04 — saving contact suggestion creates a contact record', async ({ page }) => {
    await page.goto('/contacts')
    const initialCount = await page.getByTestId('contact-list-item').count()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const contactCard = page.getByTestId('contact-suggestion-card').first()
    await contactCard.getByTestId('contact-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    // Doctor suggestion banner may appear — accept it to fully create contact
    const banner = page.getByTestId('doctor-suggestion-banner')
    const bannerVisible = await banner.isVisible({ timeout: 8_000 }).catch(() => false)
    if (bannerVisible) {
      await banner.getByRole('button', { name: /add to contacts/i }).click()
      const form = page.getByRole('dialog')
      await expect(form).toBeVisible()
      await form.getByRole('button', { name: /save/i }).click()
      await expect(form).not.toBeVisible({ timeout: 5_000 })
    }

    await page.goto('/contacts')
    const finalCount = await page.getByTestId('contact-list-item').count()
    expect(finalCount).toBeGreaterThan(initialCount)
  })

  test('TC-UPLOAD-05 — review step shows invoice and PHYSIOTHERAPY tags', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const chips = page.getByTestId('tag-chip')
    const chipTexts = await chips.allTextContents()
    const normalised = chipTexts.map((t) => t.toLowerCase())
    expect(normalised.some((t) => t.includes('invoice'))).toBe(true)
    expect(normalised.some((t) => t.includes('physiotherapy'))).toBe(true)
  })

  test('TC-UPLOAD-06 — appointment suggestion banner appears after upload with 2024 date', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    const apptBanner = page.getByText(/appointment detected/i)
    await expect(apptBanner).toBeVisible({ timeout: 15_000 })

    await expect(page.getByText(/2024|jan/i).first()).toBeVisible()
  })

  test('TC-UPLOAD-07 — confirming appointment suggestion creates an appointment', async ({ page }) => {
    await page.goto('/appointments')
    const initialCount = await page.getByTestId('appointment-card').count()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    await expect(page.getByText(/appointment detected/i)).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /create appointment/i }).click()

    await expect(page.getByText(/appointment detected/i)).not.toBeVisible({ timeout: 8_000 })

    await page.goto('/appointments')
    const finalCount = await page.getByTestId('appointment-card').count()
    expect(finalCount).toBeGreaterThan(initialCount)
  })
})
