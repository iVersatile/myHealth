import { test, expect } from './fixtures'

// Regression tests for two user-reported issues:
// Issue 1: Clicking clinic badge on /contacts led to 404 (href used clinic.id not query param)
// Issue 2: Linking a doctor via Edit Contact UI did not appear in GET /clinics view
//          (contacts_update wrote contacts.contact_clinic_id; clinics_list_with_contacts
//           read clinic_contacts junction table — entirely disconnected)

const CLINIC = {
  id: 'clinic-link-001',
  name: 'Harley Street Cardiology',
  company_registration_number: null,
  phone: null,
  addresses: [],
  linked_contacts: [] as string[],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  _deleted: false,
}

const DOCTOR = {
  id: 'contact-link-001',
  name: 'Dr. Anita Patel',
  role: 'specialist',
  specialty: 'Cardiology',
  phone: null,
  email: null,
  clinic: null,
  address: null,
  notes: null,
  contact_clinic_id: null as string | null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  _deleted: false,
}

async function seed(page: import('@playwright/test').Page, overrides?: {
  contactClinicId?: string | null
  clinicLinkedContacts?: string[]
}) {
  const clinicLinkedContacts = overrides?.clinicLinkedContacts ?? []
  const contactClinicId = overrides?.contactClinicId ?? null

  await page.addInitScript((data: {
    clinic: typeof CLINIC
    doctor: typeof DOCTOR
    clinicLinkedContacts: string[]
    contactClinicId: string | null
  }) => {
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

    const clinic = { ...data.clinic, linked_contacts: data.clinicLinkedContacts }
    const doctor = { ...data.doctor, contact_clinic_id: data.contactClinicId }

    const clinics = (state.clinics ?? []) as typeof CLINIC[]
    if (!clinics.some((c) => c.id === clinic.id)) clinics.push(clinic)
    else Object.assign(clinics.find((c) => c.id === clinic.id)!, clinic)
    state.clinics = clinics

    const contacts = (state.contacts ?? []) as typeof DOCTOR[]
    if (!contacts.some((c) => c.id === doctor.id)) contacts.push(doctor)
    else Object.assign(contacts.find((c) => c.id === doctor.id)!, doctor)
    state.contacts = contacts

    sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
  }, {
    clinic: CLINIC,
    doctor: DOCTOR,
    clinicLinkedContacts,
    contactClinicId,
  })
}

test.describe('Clinic-Contact link — regression suite', () => {
  test('TC-LINK-01 — doctor linked via junction table appears in clinic list', async ({ page }) => {
    // Regression: contacts_update now writes junction table; clinics_list_with_contacts reads it.
    // Seed: doctor already linked to clinic (simulates post-migration state).
    await seed(page, {
      contactClinicId: CLINIC.id,
      clinicLinkedContacts: [DOCTOR.id],
    })
    await page.goto('http://localhost:3000/clinics')

    const clinicCard = page.getByTestId('clinic-card').filter({ hasText: CLINIC.name })
    await expect(clinicCard).toBeVisible()
    await expect(clinicCard).toContainText('Dr. Anita Patel')
  })

  test('TC-LINK-02 — edit contact, select clinic, save → doctor appears in clinic list', async ({ page }) => {
    // Regression: mock contacts_update now mirrors junction table update.
    await seed(page)
    await page.goto('http://localhost:3000/contacts')

    const contactCard = page.getByTestId('contact-list-item').filter({ hasText: 'Dr. Anita Patel' })
    await expect(contactCard).toBeVisible()
    await contactCard.getByRole('button', { name: /edit/i }).click()

    const dropdown = page.getByRole('combobox', { name: /clinic.*hospital/i })
    await expect(dropdown).toBeVisible()
    await dropdown.selectOption({ label: CLINIC.name })
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5_000 })

    await page.goto('http://localhost:3000/clinics')
    const clinicCard = page.getByTestId('clinic-card').filter({ hasText: CLINIC.name })
    await expect(clinicCard).toBeVisible()
    await expect(clinicCard).toContainText('Dr. Anita Patel')
  })

  test('TC-LINK-03 — unlinking doctor via Edit Contact removes them from clinic list', async ({ page }) => {
    // Regression: frontend now sends "" (not null) for "None" → Rust deletes junction row.
    await seed(page, {
      contactClinicId: CLINIC.id,
      clinicLinkedContacts: [DOCTOR.id],
    })
    await page.goto('http://localhost:3000/contacts')

    const contactCard = page.getByTestId('contact-list-item').filter({ hasText: 'Dr. Anita Patel' })
    await contactCard.getByRole('button', { name: /edit/i }).click()

    const dropdown = page.getByRole('combobox', { name: /clinic.*hospital/i })
    await expect(dropdown).toHaveValue(CLINIC.id)
    await dropdown.selectOption({ label: '— None —' })
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5_000 })

    await page.goto('http://localhost:3000/clinics')
    const clinicCard = page.getByTestId('clinic-card').filter({ hasText: CLINIC.name })
    await expect(clinicCard).toBeVisible()
    await expect(clinicCard).not.toContainText('Dr. Anita Patel')
  })

  test('TC-LINK-04 — clinic badge on /contacts has href /clinics/edit?id= (not 404)', async ({ page }) => {
    // Regression: href was /clinics/${clinic.id} which hit [id] dynamic segment and 404'd.
    // Fix: href is now /clinics/edit?id=${clinic.id}.
    await seed(page, {
      contactClinicId: CLINIC.id,
      clinicLinkedContacts: [DOCTOR.id],
    })
    await page.goto('http://localhost:3000/contacts')

    const contactCard = page.getByTestId('contact-list-item').filter({ hasText: 'Dr. Anita Patel' })
    await expect(contactCard).toBeVisible()

    const clinicBadge = contactCard.getByTestId('linked-clinic-badge')
      .or(contactCard.getByRole('link', { name: CLINIC.name }))
    await expect(clinicBadge).toBeVisible()

    const href = await clinicBadge.getAttribute('href')
    expect(href).toMatch(/\/clinics\/edit\?id=/)
    expect(href).toContain(CLINIC.id)
  })

  test('TC-LINK-05 — clinic badge click lands on edit page without 404', async ({ page }) => {
    await seed(page, {
      contactClinicId: CLINIC.id,
      clinicLinkedContacts: [DOCTOR.id],
    })
    await page.goto('http://localhost:3000/contacts')

    const contactCard = page.getByTestId('contact-list-item').filter({ hasText: 'Dr. Anita Patel' })
    const clinicBadge = contactCard.getByTestId('linked-clinic-badge')
      .or(contactCard.getByRole('link', { name: CLINIC.name }))
    await clinicBadge.click()

    await expect(page).toHaveURL(/\/clinics\/edit\?id=/, { timeout: 5_000 })
    await expect(page.getByText('404', { exact: true })).not.toBeVisible()
    await expect(page.getByText(/this page could not be found/i)).not.toBeVisible()
  })
})
