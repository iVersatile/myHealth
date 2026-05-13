import { test, expect } from './fixtures'

const DRAFT_CONTACT = {
  id: 'draft-contact-001',
  entity_type: 'contact',
  name: 'Dr Alice Draft',
  created_at: '2026-01-01T00:00:00Z',
  role: 'doctor',
  specialty: 'General Practice',
  phone: '07700 900000',
  email: null,
  clinic: null,
  address: null,
  notes: null,
  merge_candidate_id: null,
  appt_date: null,
  doctor_name: null,
  clinic_name: null,
  status: null,
  severity: null,
  onset_date: null,
  dosage: null,
  frequency: null,
  start_date: null,
  end_date: null,
}

async function seedDraftContact(page: import('@playwright/test').Page) {
  // Inject an init script that re-seeds after the fixture's sessionStorage.removeItem on every navigation.
  // fixtures.ts clears tauri_mock_state before each page load; this runs after that clear and re-establishes the draft.
  await page.addInitScript((draft: typeof DRAFT_CONTACT) => {
    const STATE_KEY = 'tauri_mock_state'
    const raw = sessionStorage.getItem(STATE_KEY)
    const state: { draft_contacts: typeof DRAFT_CONTACT[] } & Record<string, unknown> = raw
      ? JSON.parse(raw)
      : {
          documents: [], contacts: [], clinics: [], appointments: [],
          notes: [], categories: [], trash: [], symptoms: [],
          medications: [], entity_links: [],
          draft_contacts: [], draft_clinics: [], draft_appointments: [],
        }
    if (!state.draft_contacts.some((d) => d.id === draft.id)) {
      state.draft_contacts.push(draft)
    }
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
  }, DRAFT_CONTACT)
}

test.describe('Phase 61 — Draft Entity Review UI', () => {
  test('TC-DRAFT-01 — draft-entity-card visible with accept and reject buttons', async ({ page }) => {
    await seedDraftContact(page)
    await page.goto('http://localhost:3000/contacts')
    await expect(page.getByTestId('draft-review-section')).toBeVisible()
    await expect(page.getByTestId('draft-entity-card')).toBeVisible()
    await expect(page.getByTestId('draft-badge')).toBeVisible()
    await expect(page.getByTestId('accept-draft-btn')).toBeVisible()
    await expect(page.getByTestId('reject-draft-btn')).toBeVisible()
  })

  test('TC-DRAFT-02 — accept draft removes card and leaves no draft badge', async ({ page }) => {
    await seedDraftContact(page)
    await page.goto('http://localhost:3000/contacts')
    await expect(page.getByTestId('draft-entity-card')).toBeVisible()
    await page.getByTestId('accept-draft-btn').click()
    await expect(page.getByTestId('draft-entity-card')).not.toBeVisible()
    await expect(page.getByTestId('draft-badge')).not.toBeVisible()
  })

  test('TC-DRAFT-03 — reject draft removes card and contact absent from permanent list', async ({ page }) => {
    await seedDraftContact(page)
    await page.goto('http://localhost:3000/contacts')
    await expect(page.getByTestId('draft-entity-card')).toBeVisible()
    await page.getByTestId('reject-draft-btn').click()
    await expect(page.getByTestId('draft-entity-card')).not.toBeVisible()
    await expect(page.getByText('Dr Alice Draft')).not.toBeVisible()
  })

  test.skip('TC-61-01 — draft-entity-card visible on Contacts page after upload', async ({ page }) => {
    // Requires real Tauri upload to create draft entities in SQLite
    void page
  })

  test.skip('TC-61-02 — draft card shows DRAFT badge', async ({ page }) => {
    // Requires real Tauri upload
    void page
  })

  test.skip('TC-61-03 — Accept button present on draft card', async ({ page }) => {
    // Requires real Tauri upload
    void page
  })

  test.skip('TC-61-04 — Reject button present on draft card', async ({ page }) => {
    // Requires real Tauri upload
    void page
  })

  test.skip('TC-61-05 — accepting draft removes card optimistically', async ({ page }) => {
    // Requires real Tauri upload
    void page
  })

  test.skip('TC-61-06 — rejecting draft removes card optimistically', async ({ page }) => {
    // Requires real Tauri upload
    void page
  })

  test.skip('TC-61-07 — Merge button opens merge dialog when duplicate detected', async ({ page }) => {
    // Requires real Tauri upload with duplicate detection
    void page
  })

  test.skip('TC-61-08 — draft-review-section visible on Clinics page after upload', async ({ page }) => {
    // DraftEntitySection returns null when no drafts exist; requires Tauri
    void page
  })

  test.skip('TC-61-09 — draft-review-section visible on Symptoms page after upload', async ({ page }) => {
    // Requires real Tauri upload
    void page
  })

  test.skip('TC-61-10 — draft-review-section visible on Medications page after upload', async ({ page }) => {
    // Requires real Tauri upload
    void page
  })

  test('TC-61-11 — non-regression: contacts list excludes draft rows', async ({ page }) => {
    await page.goto('http://localhost:3000/contacts')
    const allRows = page.locator('[data-testid="contact-list-item"]')
    const count = await allRows.count()
    for (let i = 0; i < count; i++) {
      await expect(allRows.nth(i).locator('[data-testid="draft-badge"]')).not.toBeVisible()
    }
  })

  test('TC-61-12 — non-regression: clinics list excludes draft rows', async ({ page }) => {
    await page.goto('http://localhost:3000/clinics')
    const allRows = page.locator('[data-testid="clinic-row"]')
    const count = await allRows.count()
    for (let i = 0; i < count; i++) {
      await expect(allRows.nth(i).locator('[data-testid="draft-badge"]')).not.toBeVisible()
    }
  })

  test.skip('TC-61-13 — draft section shows empty state when all drafts resolved', async ({ page }) => {
    // Requires real Tauri upload to create drafts first
    void page
  })
})
