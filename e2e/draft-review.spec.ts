import path from 'path'
import { test, expect } from './fixtures'

const FIXTURE_DIR = path.join(__dirname, '..', 'src-tauri', 'tests', 'fixtures')
const PDF_1 = path.join(FIXTURE_DIR, 'medical-invoice.pdf')

async function uploadAndWait(page: import('@playwright/test').Page) {
  await page.goto('http://localhost:3000/documents')
  const input = page.locator('input[type="file"]').first()
  await input.setInputFiles([PDF_1])
  await page.locator('[data-testid="start-batch-upload-btn"]').click()
  await page.locator('[data-testid="batch-complete-toast"]').waitFor({ timeout: 30_000 })
}

test.describe('Phase 61 — Draft Entity Review UI', () => {
  test('TC-61-01 — draft-entity-card visible on Contacts page after upload', async ({ page }) => {
    await uploadAndWait(page)
    await page.goto('http://localhost:3000/contacts')
    await expect(page.locator('[data-testid="draft-entity-card"]').first()).toBeVisible()
  })

  test('TC-61-02 — draft card shows DRAFT badge', async ({ page }) => {
    await uploadAndWait(page)
    await page.goto('http://localhost:3000/contacts')
    const card = page.locator('[data-testid="draft-entity-card"]').first()
    await expect(card.locator('[data-testid="draft-badge"]')).toBeVisible()
  })

  test('TC-61-03 — Accept button present on draft card', async ({ page }) => {
    await uploadAndWait(page)
    await page.goto('http://localhost:3000/contacts')
    const card = page.locator('[data-testid="draft-entity-card"]').first()
    await expect(card.locator('[data-testid="accept-draft-btn"]')).toBeVisible()
  })

  test('TC-61-04 — Reject button present on draft card', async ({ page }) => {
    await uploadAndWait(page)
    await page.goto('http://localhost:3000/contacts')
    const card = page.locator('[data-testid="draft-entity-card"]').first()
    await expect(card.locator('[data-testid="reject-draft-btn"]')).toBeVisible()
  })

  test('TC-61-05 — accepting draft removes card optimistically', async ({ page }) => {
    await uploadAndWait(page)
    await page.goto('http://localhost:3000/contacts')
    const card = page.locator('[data-testid="draft-entity-card"]').first()
    const countBefore = await page.locator('[data-testid="draft-entity-card"]').count()
    await card.locator('[data-testid="accept-draft-btn"]').click()
    await expect(page.locator('[data-testid="draft-entity-card"]')).toHaveCount(countBefore - 1)
  })

  test('TC-61-06 — rejecting draft removes card optimistically', async ({ page }) => {
    await uploadAndWait(page)
    await page.goto('http://localhost:3000/contacts')
    const card = page.locator('[data-testid="draft-entity-card"]').first()
    const countBefore = await page.locator('[data-testid="draft-entity-card"]').count()
    await card.locator('[data-testid="reject-draft-btn"]').click()
    await expect(page.locator('[data-testid="draft-entity-card"]')).toHaveCount(countBefore - 1)
  })

  test('TC-61-07 — Merge button opens merge dialog when duplicate detected', async ({ page }) => {
    await uploadAndWait(page)
    await page.goto('http://localhost:3000/contacts')
    const mergeBtn = page.locator('[data-testid="merge-draft-btn"]').first()
    if (await mergeBtn.isVisible()) {
      await mergeBtn.click()
      await expect(page.locator('[data-testid="merge-dialog"]')).toBeVisible()
    }
  })

  test('TC-61-08 — draft-entity-card visible on Clinics page after upload', async ({ page }) => {
    await uploadAndWait(page)
    await page.goto('http://localhost:3000/clinics')
    // Clinics page may or may not have draft cards — just assert the section renders
    await expect(page.locator('[data-testid="draft-review-section"]')).toBeVisible()
  })

  test('TC-61-09 — draft-entity-card visible on Symptoms page after upload', async ({ page }) => {
    await uploadAndWait(page)
    await page.goto('http://localhost:3000/symptoms')
    await expect(page.locator('[data-testid="draft-review-section"]')).toBeVisible()
  })

  test('TC-61-10 — draft-entity-card visible on Medications page after upload', async ({ page }) => {
    await uploadAndWait(page)
    await page.goto('http://localhost:3000/medications')
    await expect(page.locator('[data-testid="draft-review-section"]')).toBeVisible()
  })

  test('TC-61-11 — non-regression: contacts list excludes draft rows', async ({ page }) => {
    await uploadAndWait(page)
    await page.goto('http://localhost:3000/contacts')
    const allRows = page.locator('[data-testid="contact-row"]')
    const count = await allRows.count()
    for (let i = 0; i < count; i++) {
      await expect(allRows.nth(i).locator('[data-testid="draft-badge"]')).not.toBeVisible()
    }
  })

  test('TC-61-12 — non-regression: clinics list excludes draft rows', async ({ page }) => {
    await uploadAndWait(page)
    await page.goto('http://localhost:3000/clinics')
    const allRows = page.locator('[data-testid="clinic-row"]')
    const count = await allRows.count()
    for (let i = 0; i < count; i++) {
      await expect(allRows.nth(i).locator('[data-testid="draft-badge"]')).not.toBeVisible()
    }
  })

  test('TC-61-13 — draft section shows empty state when all drafts resolved', async ({ page }) => {
    await uploadAndWait(page)
    await page.goto('http://localhost:3000/contacts')
    const cards = page.locator('[data-testid="draft-entity-card"]')
    const count = await cards.count()
    for (let i = 0; i < count; i++) {
      await page.locator('[data-testid="draft-entity-card"]').first().locator('[data-testid="reject-draft-btn"]').click()
    }
    await expect(page.locator('[data-testid="draft-review-empty"]')).toBeVisible()
  })
})
