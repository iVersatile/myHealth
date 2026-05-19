/**
 * Batch document upload — auto-created appointments, clinics, and contacts.
 *
 * Full E2E of the upload→extraction→creation pipeline requires the real Tauri
 * backend (Rust commands, SQLite, LLM extraction). Those tests are skipped here.
 *
 * What IS testable without Tauri:
 *   - Seeded appointment with doctor_name / clinic_name shows them in detail view
 *   - Seeded contact linked to a clinic via contact_clinic_id renders clinic name
 *   - Appointments page lists seeded appointments
 */
import { test, expect } from './fixtures'

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEEDED_CLINIC = {
  id: 'clinic-batch-001',
  name: "St. Mark's Hospital",
  company_registration_number: null,
  phone: null,
  addresses: [],
  linked_contacts: [],
  created_at: '2026-03-01T09:00:00Z',
  updated_at: '2026-03-01T09:00:00Z',
  _deleted: false,
}

const SEEDED_CONTACT = {
  id: 'contact-batch-001',
  name: 'Dr. Sarah Wells',
  role: 'specialist',
  specialty: 'Neurology',
  phone: '07700000002',
  email: null,
  clinic: "St. Mark's Hospital",
  address: null,
  notes: null,
  contact_clinic_id: 'clinic-batch-001',
  created_at: '2026-03-01T09:00:00Z',
  updated_at: '2026-03-01T09:00:00Z',
  _deleted: false,
}

const SEEDED_APPOINTMENT = {
  id: 'appt-batch-001',
  title: "Neurology Appointment at St. Mark's Hospital",
  appt_date: '2026-04-15T14:00:00Z',
  doctor_name: 'Dr. Sarah Wells',
  clinic_name: "St. Mark's Hospital",
  specialty: 'Neurology',
  status: 'upcoming',
  location: null,
  duration_min: 30,
  notes: null,
  reminder_offsets: null,
  linked_contact_id: 'contact-batch-001',
  linked_clinic_id: 'clinic-batch-001',
  created_at: '2026-03-01T09:00:00Z',
  updated_at: '2026-03-01T09:00:00Z',
  _deleted: false,
}

type SeedData = {
  clinic: typeof SEEDED_CLINIC
  contact: typeof SEEDED_CONTACT
  appointment: typeof SEEDED_APPOINTMENT
}

async function seedEntities(page: import('@playwright/test').Page) {
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
    if (!clinics.some((c) => c.id === data.clinic.id)) clinics.push(data.clinic)
    state.clinics = clinics

    const contacts = (state.contacts ?? []) as typeof SEEDED_CONTACT[]
    if (!contacts.some((c) => c.id === data.contact.id)) contacts.push(data.contact)
    state.contacts = contacts

    const appointments = (state.appointments ?? []) as typeof SEEDED_APPOINTMENT[]
    if (!appointments.some((a) => a.id === data.appointment.id)) appointments.push(data.appointment)
    state.appointments = appointments

    sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
  }, { clinic: SEEDED_CLINIC, contact: SEEDED_CONTACT, appointment: SEEDED_APPOINTMENT })
}

// ── Skipped: requires real Tauri ───────────────────────────────────────────────

test.describe('Batch upload — auto-created entities (requires real Tauri)', () => {
  test.skip('TC-BATCH-ENT-01 — uploading 3 documents creates 3 appointments', async ({ page }) => {
    // Requires real Tauri file picker and documents_run_extraction Rust command.
    void page
  })

  test.skip('TC-BATCH-ENT-02 — batch upload creates draft clinic for each new hospital', async ({ page }) => {
    // Requires real Tauri LLM extraction pipeline.
    void page
  })

  test.skip('TC-BATCH-ENT-03 — batch upload creates draft contact for each new doctor', async ({ page }) => {
    // Requires real Tauri LLM extraction pipeline.
    void page
  })

  test.skip('TC-BATCH-ENT-04 — appointment links to draft contact via linked_contact_id', async ({ page }) => {
    // Requires real Tauri — draft_appointment_id assigned by Rust.
    void page
  })

  test.skip('TC-BATCH-ENT-05 — accepting draft clinic sets is_draft=false; appointment clinic_name unchanged', async ({ page }) => {
    // Requires real Tauri backend to transition draft → accepted.
    void page
  })
})

// ── Testable via seeded state ──────────────────────────────────────────────────

test.describe('Batch upload — entity links display (seeded state)', () => {
  test('TC-BATCH-ENT-06 — appointment detail shows doctor_name from linked contact', async ({ page }) => {
    await seedEntities(page)
    await page.goto(`http://localhost:3000/appointments/view?id=${SEEDED_APPOINTMENT.id}`)

    await expect(page.getByRole('heading', { name: /Neurology Appointment/i })).toBeVisible()
    await expect(page.getByText('Dr. Sarah Wells')).toBeVisible()
  })

  test('TC-BATCH-ENT-07 — appointment detail shows clinic_name from linked clinic', async ({ page }) => {
    await seedEntities(page)
    await page.goto(`http://localhost:3000/appointments/view?id=${SEEDED_APPOINTMENT.id}`)

    await expect(page.getByText("St. Mark's Hospital")).toBeVisible()
  })

  test('TC-BATCH-ENT-08 — appointments list shows seeded appointment title', async ({ page }) => {
    await seedEntities(page)
    await page.goto('http://localhost:3000/appointments')

    await expect(page.getByText(/Neurology Appointment/i)).toBeVisible()
  })

  test('TC-BATCH-ENT-09 — contact linked to clinic shows clinic name on contacts page', async ({ page }) => {
    await seedEntities(page)
    await page.goto('http://localhost:3000/contacts')

    const contactCard = page.getByTestId('contact-list-item').filter({ hasText: 'Dr. Sarah Wells' })
    await expect(contactCard).toBeVisible()
    await expect(contactCard).toContainText("St. Mark's Hospital")
  })
})
