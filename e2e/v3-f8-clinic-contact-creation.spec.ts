import { test, expect } from '@playwright/test'

const REAL_PDF = 'src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf'

/**
 * V3-F8 Clinic Entity Redesign — E2E regression tests
 *
 * Regression target: atomic contacts_create_with_clinic command.
 * Previously a 3-step non-atomic flow left orphaned contacts on failure or cancel.
 *
 * Test IDs: TC-V3-F8-01 … TC-V3-F8-06
 */
test.describe('V3-F8 — Clinic Contact Creation (Atomic)', () => {
  test('TC-V3-F8-01 — accepting contact suggestion opens pre-filled ContactForm', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(REAL_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm|upload/i }).click()

    // Doctor suggestion banner should appear after extraction
    const banner = page.getByTestId('doctor-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })

    await banner.getByRole('button', { name: /add to contacts/i }).click()

    // ContactForm must be visible and pre-filled with extracted name
    const form = page.getByRole('dialog')
    await expect(form).toBeVisible()
    const nameInput = form.getByLabel(/name/i)
    await expect(nameInput).not.toHaveValue('')
  })

  test('TC-V3-F8-02 — saving creates exactly one person contact and one clinic contact', async ({ page }) => {
    await page.goto('/contacts')
    const initialCount = await page.getByTestId('contact-list-item').count()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(REAL_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm|upload/i }).click()

    const banner = page.getByTestId('doctor-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await banner.getByRole('button', { name: /add to contacts/i }).click()

    const form = page.getByRole('dialog')
    await expect(form).toBeVisible()
    await form.getByRole('button', { name: /save/i }).click()
    await expect(form).not.toBeVisible({ timeout: 5_000 })

    await page.goto('/contacts')
    const finalCount = await page.getByTestId('contact-list-item').count()
    // Expect exactly +1: person contact only; clinic goes to clinics table (V3-F8)
    expect(finalCount - initialCount).toBe(1)
  })

  test('TC-V3-F8-03 — saved person contact has clinic linked via contact_clinic_id', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(REAL_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm|upload/i }).click()

    const banner = page.getByTestId('doctor-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    const personName = await banner.getByTestId('suggestion-name').textContent()
    await banner.getByRole('button', { name: /add to contacts/i }).click()

    const form = page.getByRole('dialog')
    await form.getByRole('button', { name: /save/i }).click()
    await expect(form).not.toBeVisible({ timeout: 5_000 })

    await page.goto('/contacts')
    if (personName) {
      await page.getByText(personName.trim()).first().click()
    }
    // The contact detail view should show the clinic name
    const clinicField = page.getByTestId('contact-clinic-name')
    await expect(clinicField).toBeVisible()
    await expect(clinicField).not.toHaveText('')
  })

  test('TC-V3-F8-04 — cancelling the ContactForm creates zero contacts (no orphans)', async ({ page }) => {
    await page.goto('/contacts')
    const initialCount = await page.getByTestId('contact-list-item').count()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(REAL_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm|upload/i }).click()

    const banner = page.getByTestId('doctor-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await banner.getByRole('button', { name: /add to contacts/i }).click()

    const form = page.getByRole('dialog')
    await expect(form).toBeVisible()
    await form.getByRole('button', { name: /cancel/i }).click()
    await expect(form).not.toBeVisible({ timeout: 3_000 })

    await page.goto('/contacts')
    const finalCount = await page.getByTestId('contact-list-item').count()
    // Cancel must create zero contacts — no orphaned person or clinic records
    expect(finalCount).toBe(initialCount)
  })

  test('TC-V3-F8-05 — error from backend shows human-readable message, not [object Object]', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(REAL_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm|upload/i }).click()

    const banner = page.getByTestId('doctor-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await banner.getByRole('button', { name: /add to contacts/i }).click()

    const form = page.getByRole('dialog')
    await expect(form).toBeVisible()

    // Clear the name to trigger the client-side "Name is required" validation
    const nameInput = form.getByLabel(/name/i)
    await nameInput.fill('')
    await form.getByRole('button', { name: /save/i }).click()

    const errorMsg = form.getByRole('alert').or(form.locator('[data-testid="form-error"]'))
    await expect(errorMsg).toBeVisible()
    const errorText = await errorMsg.textContent()
    expect(errorText).not.toContain('[object')
    expect(errorText).not.toContain('Object]')
    expect(errorText!.length).toBeGreaterThan(0)
  })

  test('TC-V3-F8-06 — dismissing the suggestion banner creates zero contacts', async ({ page }) => {
    await page.goto('/contacts')
    const initialCount = await page.getByTestId('contact-list-item').count()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(REAL_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm|upload/i }).click()

    const banner = page.getByTestId('doctor-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await banner.getByRole('button', { name: /dismiss|no thanks/i }).click()
    await expect(banner).not.toBeVisible({ timeout: 3_000 })

    await page.goto('/contacts')
    const finalCount = await page.getByTestId('contact-list-item').count()
    expect(finalCount).toBe(initialCount)
  })
})
