import { test, expect } from './fixtures'

test.describe('Phase 61 — Draft Entity Review UI', () => {
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
