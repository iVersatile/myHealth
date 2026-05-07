import { test, expect } from './fixtures'

const FIXTURE_PDF = 'src-tauri/tests/fixtures/medical-invoice.pdf'

/**
 * E2E acceptance tests: Verify extracted fields and edit entities
 *
 * Pre-condition: each test uploads medical-invoice.pdf and saves all suggestions
 * so that a contact, clinic, and appointment are created fresh per test.
 *
 * TC-EDIT-01: Created appointment has extracted doctor name and Jan 2024 date
 * TC-EDIT-02: Appointment can be edited and changes persist
 * TC-EDIT-03: Created clinic record shows correct CRN
 * TC-EDIT-04: Clinic record can be edited and changes persist
 * TC-EDIT-05: Created contact appears in contacts list
 */

async function uploadAndAcceptAll(page: import('@playwright/test').Page) {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  await page.locator('input[type="file"]').setInputFiles(FIXTURE_PDF)
  await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

  // Save clinic suggestion
  const clinicCard = page.getByTestId('clinic-suggestion-card').first()
  if (await clinicCard.isVisible()) {
    await clinicCard.getByTestId('clinic-suggestion-save').click()
  }

  // Save contact suggestion (in-dialog save before confirm)
  const contactCard = page.getByTestId('contact-suggestion-card').first()
  if (await contactCard.isVisible()) {
    await contactCard.getByTestId('contact-suggestion-save').click()
  }

  await page.getByRole('button', { name: /confirm upload/i }).click()
  await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

  // Handle doctor suggestion banner
  const banner = page.getByTestId('doctor-suggestion-banner')
  const bannerVisible = await banner.isVisible({ timeout: 8_000 }).catch(() => false)
  if (bannerVisible) {
    await banner.getByRole('button', { name: /add to contacts/i }).click()
    const form = page.getByRole('dialog')
    if (await form.isVisible()) {
      await form.getByRole('button', { name: /save/i }).click()
      await expect(form).not.toBeVisible({ timeout: 5_000 })
    }
  }

  // Handle appointment suggestion banner
  const apptBanner = page.getByText(/appointment detected/i)
  const apptVisible = await apptBanner.isVisible({ timeout: 12_000 }).catch(() => false)
  if (apptVisible) {
    await page.getByRole('button', { name: /create appointment/i }).click()
    await expect(apptBanner).not.toBeVisible({ timeout: 8_000 })
  }
}

test.describe('Verify extracted fields and edit entities', () => {
  test('TC-EDIT-01 — created appointment has extracted doctor name and Jan 2024 date', async ({ page }) => {
    await uploadAndAcceptAll(page)

    await page.goto('/appointments')
    const card = page.getByTestId('appointment-card').filter({ hasText: /mitchell|physiotherapy|assessment/i }).first()
    await expect(card).toBeVisible({ timeout: 5_000 })

    await card.getByRole('link').click()
    await expect(page.getByText(/sarah mitchell/i)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/jan|2024/i).first()).toBeVisible()
  })

  test('TC-EDIT-02 — appointment can be edited and changes persist', async ({ page }) => {
    await uploadAndAcceptAll(page)

    await page.goto('/appointments')
    const card = page.getByTestId('appointment-card').filter({ hasText: /mitchell|physiotherapy|assessment/i }).first()
    await card.getByRole('link').click()

    await page.getByRole('button', { name: /^edit$/i }).click()
    const titleInput = page.getByLabel(/title/i)
    await expect(titleInput).toBeVisible()

    const newTitle = 'Edited Physiotherapy Session'
    await titleInput.fill(newTitle)
    await page.getByRole('button', { name: /save/i }).click()

    await expect(page.getByText(newTitle)).toBeVisible({ timeout: 5_000 })

    await page.goto('/appointments')
    await page.getByTestId('appointment-card').filter({ hasText: newTitle }).first().getByRole('link').click()
    await expect(page.getByText(newTitle)).toBeVisible({ timeout: 5_000 })
  })

  test('TC-EDIT-03 — created clinic record shows correct CRN', async ({ page }) => {
    await uploadAndAcceptAll(page)

    await page.goto('/clinics')
    const clinicRow = page.getByTestId('clinic-row').filter({ hasText: /hartfield|physiotherapy/i }).first()
    await expect(clinicRow).toBeVisible({ timeout: 5_000 })
    await expect(clinicRow).toContainText('5432109')
  })

  test('TC-EDIT-04 — clinic record can be edited and changes persist', async ({ page }) => {
    await uploadAndAcceptAll(page)

    await page.goto('/clinics')
    const clinicRow = page.getByTestId('clinic-row').filter({ hasText: /hartfield|physiotherapy/i }).first()
    await expect(clinicRow).toBeVisible({ timeout: 5_000 })

    const editLink = clinicRow.getByRole('link', { name: /edit/i }).or(clinicRow.getByRole('button', { name: /edit/i }))
    await editLink.click()

    const phoneInput = page.getByLabel(/phone/i)
    await expect(phoneInput).toBeVisible()
    const updatedPhone = '020 1234 5678'
    await phoneInput.fill(updatedPhone)
    await page.getByRole('button', { name: /save/i }).click()

    await page.waitForURL(/\/clinics/, { timeout: 5_000 })
    const updatedRow = page.getByTestId('clinic-row').filter({ hasText: /hartfield|physiotherapy/i }).first()
    await updatedRow.getByRole('link', { name: /edit/i }).or(updatedRow.getByRole('button', { name: /edit/i })).click()
    await expect(page.getByLabel(/phone/i)).toHaveValue(updatedPhone)
  })

  test('TC-EDIT-05 — created contact appears in contacts list', async ({ page }) => {
    await uploadAndAcceptAll(page)

    await page.goto('/contacts')
    const contactItem = page.getByTestId('contact-list-item').filter({ hasText: /mitchell/i }).first()
    await expect(contactItem).toBeVisible({ timeout: 5_000 })
    await expect(contactItem).toContainText('Mitchell')
  })
})
