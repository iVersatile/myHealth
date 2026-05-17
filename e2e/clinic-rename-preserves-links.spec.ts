import { test, expect } from './fixtures'

const CLINIC = {
  id: 'clinic-rename-001',
  name: 'Original Clinic Name',
  address: null,
  phone: null,
  company_registration_number: null,
  addresses: [],
  linked_contacts: [] as string[],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  _deleted: false,
}

const DOCUMENT = {
  id: 'doc-rename-001',
  filename: 'referral.pdf',
  file_path: 'docs/referral.pdf',
  mime_type: 'application/pdf',
  file_size_bytes: 1024,
  category_name: 'referral',
  clinic_id: null as string | null,
  clinic_name: 'Original Clinic Name',
  doctor_name: null,
  activity_date: '2026-01-15',
  extracted_text: null,
  tags: [] as string[],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  _deleted: false,
}

async function seed(page: import('@playwright/test').Page) {
  await page.addInitScript((data: { clinic: typeof CLINIC; document: typeof DOCUMENT }) => {
    const STATE_KEY = 'tauri_mock_state'
    const raw = sessionStorage.getItem(STATE_KEY)
    const state: Record<string, unknown[]> = raw
      ? (JSON.parse(raw) as Record<string, unknown[]>)
      : {
          documents: [],
          contacts: [],
          clinics: [],
          appointments: [],
          notes: [],
          categories: [],
          trash: [],
          symptoms: [],
          medications: [],
          entity_links: [],
          draft_contacts: [],
          draft_clinics: [],
          draft_appointments: [],
        }

    const clinics = (state.clinics ?? []) as typeof CLINIC[]
    if (!clinics.some((c) => c.id === data.clinic.id)) clinics.push(data.clinic)
    state.clinics = clinics

    const documents = (state.documents ?? []) as typeof DOCUMENT[]
    if (!documents.some((d) => d.id === data.document.id)) documents.push(data.document)
    state.documents = documents

    sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
  }, { clinic: CLINIC, document: DOCUMENT })
}

test.describe('Clinic rename — link preservation', () => {
  test('TC-RENAME-01 — renaming a clinic preserves linked documents on edit page', async ({ page }) => {
    await seed(page)
    await page.goto(`http://localhost:3000/clinics/edit?id=${CLINIC.id}`)

    await expect(page.getByText('referral.pdf')).toBeVisible({ timeout: 5_000 })

    const nameInput = page.getByLabel('Name')
    await nameInput.fill('Renamed Clinic')
    await page.getByRole('button', { name: /^save$/i }).click()
    await page.waitForURL('http://localhost:3000/clinics', { timeout: 5_000 })
    await page.waitForLoadState('networkidle')

    await page.goto(`http://localhost:3000/clinics/edit?id=${CLINIC.id}`)

    await expect(page.getByLabel('Name')).toHaveValue('Renamed Clinic', { timeout: 5_000 })
    await expect(page.getByText('referral.pdf')).toBeVisible({ timeout: 5_000 })
  })
})
