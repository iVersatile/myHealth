import { test, expect } from './fixtures'

const SEEDED_CLINIC = {
  id: 'clinic-e2e-001',
  name: 'City Heart Centre',
  company_registration_number: null,
  phone: null,
  addresses: [],
  linked_contacts: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  _deleted: false,
}

const SEEDED_DRAFT_CLINIC = {
  id: 'draft-clinic-e2e-001',
  name: 'Riverside Draft Clinic',
  clinic_name: 'Riverside Draft Clinic',
  is_draft: true,
  _deleted: false,
}

const SEEDED_CONTACT = {
  id: 'contact-e2e-001',
  name: 'Dr. Jane Smith',
  role: 'specialist',
  specialty: 'Cardiology',
  phone: '07700000001',
  email: 'jane@example.com',
  clinic: null,
  address: null,
  notes: null,
  contact_clinic_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  _deleted: false,
}

type SeedData = {
  clinic: typeof SEEDED_CLINIC
  draftClinic: typeof SEEDED_DRAFT_CLINIC
  contact: typeof SEEDED_CONTACT
}

async function seedState(page: import('@playwright/test').Page) {
  await page.addInitScript((data: SeedData) => {
    const STATE_KEY = 'tauri_mock_state'
    const raw = sessionStorage.getItem(STATE_KEY)
    const state: Record<string, unknown[]> = raw
      ? (JSON.parse(raw) as Record<string, unknown[]>)
      : {
          documents: [], contacts: [], clinics: [], appointments: [],
          notes: [], categories: [], trash: [], symptoms: [],
          medications: [], entity_links: [],
          draft_contacts: [], draft_clinics: [], draft_appointments: [],
        }
    const clinics = (state.clinics ?? []) as typeof SEEDED_CLINIC[]
    if (!clinics.some((c) => c.id === data.clinic.id)) {
      clinics.push(data.clinic)
    }
    state.clinics = clinics

    const draftClinics = (state.draft_clinics ?? []) as typeof SEEDED_DRAFT_CLINIC[]
    if (!draftClinics.some((c) => c.id === data.draftClinic.id)) {
      draftClinics.push(data.draftClinic)
    }
    state.draft_clinics = draftClinics

    const contacts = (state.contacts ?? []) as typeof SEEDED_CONTACT[]
    if (!contacts.some((c) => c.id === data.contact.id)) {
      contacts.push(data.contact)
    }
    state.contacts = contacts

    sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
  }, { clinic: SEEDED_CLINIC, draftClinic: SEEDED_DRAFT_CLINIC, contact: SEEDED_CONTACT })
}

test.describe('Edit Contact — Clinic dropdown', () => {
  test('TC-CLINIC-EDIT-01 — clinic dropdown visible when opening edit form', async ({ page }) => {
    await seedState(page)
    await page.goto('http://localhost:3000/contacts')

    const contactCard = page.getByTestId('contact-list-item').filter({ hasText: 'Dr. Jane Smith' })
    await expect(contactCard).toBeVisible()
    await contactCard.getByRole('button', { name: /edit/i }).click()

    const dropdown = page.getByRole('combobox', { name: /clinic.*hospital/i })
    await expect(dropdown).toBeVisible()
  })

  test('TC-CLINIC-EDIT-02 — dropdown lists seeded accepted clinic', async ({ page }) => {
    await seedState(page)
    await page.goto('http://localhost:3000/contacts')

    const contactCard = page.getByTestId('contact-list-item').filter({ hasText: 'Dr. Jane Smith' })
    await contactCard.getByRole('button', { name: /edit/i }).click()

    const dropdown = page.getByRole('combobox', { name: /clinic.*hospital/i })
    await expect(dropdown).toBeVisible()
    await expect(dropdown.locator('option', { hasText: 'City Heart Centre' })).toHaveCount(1)
  })

  test('TC-CLINIC-EDIT-03 — dropdown contains "— None —" as first option', async ({ page }) => {
    await seedState(page)
    await page.goto('http://localhost:3000/contacts')

    const contactCard = page.getByTestId('contact-list-item').filter({ hasText: 'Dr. Jane Smith' })
    await contactCard.getByRole('button', { name: /edit/i }).click()

    const dropdown = page.getByRole('combobox', { name: /clinic.*hospital/i })
    const firstOption = dropdown.locator('option').first()
    await expect(firstOption).toHaveText('— None —')
  })

  test('TC-CLINIC-EDIT-04 — draft clinic appears with (draft) suffix', async ({ page }) => {
    await seedState(page)
    await page.goto('http://localhost:3000/contacts')

    const contactCard = page.getByTestId('contact-list-item').filter({ hasText: 'Dr. Jane Smith' })
    await contactCard.getByRole('button', { name: /edit/i }).click()

    const dropdown = page.getByRole('combobox', { name: /clinic.*hospital/i })
    await expect(dropdown.locator('option', { hasText: /Riverside Draft Clinic.*\(draft\)/ })).toHaveCount(1)
  })

  test('TC-CLINIC-EDIT-05 — selecting clinic and saving links contact to clinic', async ({ page }) => {
    await seedState(page)
    await page.goto('http://localhost:3000/contacts')

    const contactCard = page.getByTestId('contact-list-item').filter({ hasText: 'Dr. Jane Smith' })
    await contactCard.getByRole('button', { name: /edit/i }).click()

    const dropdown = page.getByRole('combobox', { name: /clinic.*hospital/i })
    await dropdown.selectOption({ label: 'City Heart Centre' })

    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 })

    // After save, the contact card should show the clinic name via LinkedClinicCard
    await expect(
      page.getByTestId('contact-list-item').filter({ hasText: 'Dr. Jane Smith' })
    ).toContainText('City Heart Centre')
  })
})
