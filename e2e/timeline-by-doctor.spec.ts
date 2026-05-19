import { test, expect } from './fixtures'

test.describe('Timeline — By Doctor grouping', () => {
  test('TC-TBD-01 — appointment linked to a contact groups under the contact name', async ({ page }) => {
    // Create a GP contact
    await page.goto('/contacts')
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByLabel(/name/i).fill('Dr Alice Smith')
    const roleSelect = page.locator('select').filter({ hasText: /role|gp|specialist/i }).first()
    await roleSelect.selectOption('gp')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText('Dr Alice Smith')).toBeVisible()

    // Create an appointment with the contact linked via the picker
    await page.goto('/appointments')
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByLabel(/title/i).fill('Annual Checkup')
    await page.locator('input[type="datetime-local"]').fill('2026-05-10T09:00')
    // Select from the doctor contact picker
    await page.locator('select[aria-label*="doctor" i]').selectOption({ label: /Dr Alice Smith/i })
    await page.getByRole('button', { name: /save/i }).click()

    // Navigate to timeline → By Doctor
    await page.goto('/timeline')
    await page.getByRole('button', { name: /by doctor/i }).click()
    await expect(page.getByText('Dr Alice Smith')).toBeVisible()
    await expect(page.getByText('Annual Checkup')).toBeVisible()
  })

  test('TC-TBD-02 — appointment with free-text doctor_name groups under that name', async ({ page }) => {
    await page.goto('/appointments')
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByLabel(/title/i).fill('Dental Check')
    await page.locator('input[type="datetime-local"]').fill('2026-05-11T14:00')
    // Fill free-text doctor name (no linked contact)
    await page.locator('input#appt-doctor').fill('Dr Bob Dentist')
    await page.getByRole('button', { name: /save/i }).click()

    await page.goto('/timeline')
    await page.getByRole('button', { name: /by doctor/i }).click()
    await expect(page.getByText('Dr Bob Dentist')).toBeVisible()
    await expect(page.getByText('Dental Check')).toBeVisible()
  })

  test('TC-TBD-03 — appointment with no doctor groups under "No doctor assigned"', async ({ page }) => {
    await page.goto('/appointments')
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByLabel(/title/i).fill('Blood Test')
    await page.locator('input[type="datetime-local"]').fill('2026-05-12T08:30')
    // Leave doctor fields blank
    await page.getByRole('button', { name: /save/i }).click()

    await page.goto('/timeline')
    await page.getByRole('button', { name: /by doctor/i }).click()
    await expect(page.getByText('No doctor / Service')).toBeVisible()
    await expect(page.getByText('Blood Test')).toBeVisible()
  })
})
