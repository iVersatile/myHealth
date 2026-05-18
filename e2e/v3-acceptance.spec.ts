import { test, expect } from './fixtures'

const ECG_PDF = 'e2e/fixtures/ecg-invoice-london-clinic-dec2023.pdf'
const GP_PDF = 'e2e/fixtures/gp-notes-dr-sharma-2023.pdf'
const SKIN_PDF = 'e2e/fixtures/skin-invoice-2023.pdf'
const NEURO_PDF = 'e2e/fixtures/neurology-scan-letter-nov2019.pdf'
const GYNAEC_PDF = 'e2e/fixtures/gynaecology-invoice-2023.pdf'

// ── Case 1 — Single Invoice, Draft Entities, Accept Flow ──────────────────────
//
// PRD §8.1 Fixture: ecg-invoice-london-clinic-dec2023.pdf
//   → contact: Dr Sarah Chen (Cardiology)
//   → clinic: The London Cardiac Centre
//   → tags: ECG, Cardiology, invoice, 2023-11-23
//   → appointment_suggestion: { date: '2023-11-23', type: 'Cardiology' }

test.describe('Acceptance Case 1 — Single Invoice, Draft Entities, Accept Flow', () => {
  test('TC-AC1-01 — document row visible in list after upload', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(
      page.getByText(/ecg-invoice-london-clinic-dec2023/i),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('TC-AC1-02 — OCR-extracted tags visible in review step (ECG, Cardiology, invoice)', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: 'ECG' })).toBeVisible()
    await expect(pills.filter({ hasText: 'Cardiology' })).toBeVisible()
    await expect(pills.filter({ hasText: 'invoice' })).toBeVisible()
  })

  test('TC-AC1-03 — date tag extracted from document body visible', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: '2023-11-23' })).toBeVisible()
  })

  test('TC-AC1-04 — draft contact card visible with doctor name and specialty', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('contact-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Dr Sarah Chen')
    await expect(card).toContainText(/Cardiology/i)
  })

  test('TC-AC1-05 — draft clinic card visible with clinic name', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('clinic-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText(/London Cardiac Centre/i)
  })

  test('TC-AC1-06 — appointment suggestion banner visible with extracted date after upload', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await expect(banner).toContainText('2023-11-23')
    await expect(banner).toContainText(/Cardiology/i)
  })

  test('TC-AC1-07 — accepting appointment suggestion creates appointment record', async ({
    page,
  }) => {
    await page.goto('/appointments')
    const initialCount = await page.getByTestId('appointment-card').count()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await banner.getByRole('button', { name: /create appointment/i }).click()
    await expect(banner).not.toBeVisible({ timeout: 8_000 })

    await page.goto('/appointments')
    const finalCount = await page.getByTestId('appointment-card').count()
    expect(finalCount).toBeGreaterThan(initialCount)
  })

  test('TC-AC1-08 — accepting draft contact creates contact record', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    await page.getByTestId('contact-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await page.goto('/contacts')
    await expect(page.getByText('Dr Sarah Chen')).toBeVisible({ timeout: 10_000 })
  })

  test('TC-AC1-09 — dismissing draft contact does not create contact', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(ECG_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    await page.getByTestId('contact-suggestion-dismiss').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await page.goto('/contacts')
    await expect(page.getByText('Dr Sarah Chen')).not.toBeVisible()
  })
})

// ── Case 2 — GP Notes, Existing Contact No-Dup, Draft Clinic ─────────────────
//
// PRD §8.2 Fixture: gp-notes-dr-sharma-2023.pdf
//   → contact: Dr Priya Sharma (General Practice) — pre-seeded; should NOT produce draft card
//   → clinic: Riverside Medical Practice
//   → tags: GP notes, General Practice, 2023-09-15
//   → appointment_suggestion: { date: '2023-09-15', type: 'General Practice' }

test.describe('Acceptance Case 2 — GP Notes, Existing Contact No-Dup, Draft Clinic', () => {
  test('TC-AC2-01 — document row visible in list after upload', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByText(/gp-notes-dr-sharma-2023/i)).toBeVisible({ timeout: 10_000 })
  })

  test('TC-AC2-02 — GP notes and General Practice tags visible in review step', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: 'GP notes' })).toBeVisible()
    await expect(pills.filter({ hasText: 'General Practice' })).toBeVisible()
  })

  test('TC-AC2-03 — date tag 2023-09-15 extracted from document body', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: '2023-09-15' })).toBeVisible()
  })

  test('TC-AC2-04 — DoctorSuggestionBanner suppressed when Dr Priya Sharma already exists', async ({
    page,
  }) => {
    // Pre-seed the contact via the first upload's review-step save
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByTestId('contact-suggestion-save').click()
    await expect(page.getByTestId('contact-suggestion-save')).toContainText(/saved/i, { timeout: 5_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    // Second upload — contacts_find_similar returns the existing contact,
    // so DoctorSuggestionBanner must NOT render
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    await expect(page.getByTestId('doctor-suggestion-banner')).not.toBeVisible({ timeout: 5_000 })
  })

  test('TC-AC2-05 — draft clinic card visible with Riverside Medical Practice', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('clinic-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText(/Riverside Medical Practice/i)
  })

  test('TC-AC2-06 — appointment suggestion banner visible with date 2023-09-15', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await expect(banner).toContainText('2023-09-15')
    await expect(banner).toContainText(/General Practice/i)
  })

  test('TC-AC2-07 — accepting appointment suggestion creates appointment record', async ({
    page,
  }) => {
    await page.goto('/appointments')
    const initialCount = await page.getByTestId('appointment-card').count()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await banner.getByRole('button', { name: /create appointment/i }).click()
    await expect(banner).not.toBeVisible({ timeout: 8_000 })

    await page.goto('/appointments')
    const finalCount = await page.getByTestId('appointment-card').count()
    expect(finalCount).toBeGreaterThan(initialCount)
  })

  test('TC-AC2-08 — accepting draft clinic creates clinic record', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    await page.getByTestId('clinic-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await page.goto('/clinics')
    await expect(page.getByText(/Riverside Medical Practice/i)).toBeVisible({ timeout: 10_000 })
  })

  test('TC-AC2-09 — dismissing draft clinic does not create clinic record', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GP_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    await page.getByTestId('clinic-suggestion-dismiss').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await page.goto('/clinics')
    await expect(page.getByText(/Riverside Medical Practice/i)).not.toBeVisible()
  })
})

// ── Case 3 — Dermatology / Neurology / Gynaecology ───────────────────────────
//
// PRD §8.3 Fixtures:
//   skin-invoice-2023.pdf
//     → contact: none
//     → clinic: ClearSkin Dermatology Clinic
//     → tags: Dermatology, invoice, 2023-07-10
//     → appointment_suggestion: { date: '2023-07-10', type: 'Dermatology' }
//   neurology-scan-letter-nov2019.pdf
//     → contact: none
//     → clinic: National Hospital for Neurology
//     → tags: Neurology, referral, 2019-11-21
//     → appointment_suggestion: null
//   gynaecology-invoice-2023.pdf
//     → contact: Dr Helen Moore (Gynaecology)
//     → clinic: Women's Health London
//     → tags: Gynaecology, invoice, 2023-04-05
//     → appointment_suggestion: { date: '2023-04-05', type: 'Gynaecology' }

test.describe('Acceptance Case 3 — Dermatology / Neurology / Gynaecology', () => {
  // ── Dermatology ─────────────────────────────────────────────────────────

  test('TC-AC3-01 — skin document row visible in list after upload', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(SKIN_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByText(/skin-invoice-2023/i)).toBeVisible({ timeout: 10_000 })
  })

  test('TC-AC3-02 — skin tags Dermatology / invoice / 2023-07-10 in review step', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(SKIN_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: 'Dermatology' })).toBeVisible()
    await expect(pills.filter({ hasText: 'invoice' })).toBeVisible()
    await expect(pills.filter({ hasText: '2023-07-10' })).toBeVisible()
  })

  test('TC-AC3-03 — skin clinic card shows ClearSkin Dermatology Clinic', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(SKIN_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('clinic-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText(/ClearSkin Dermatology Clinic/i)
  })

  test('TC-AC3-04 — skin has no contact suggestion card (no doctor extracted)', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(SKIN_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    await expect(page.getByTestId('contact-suggestion-card')).not.toBeVisible()
  })

  test('TC-AC3-05 — skin appointment banner shows 2023-07-10 / Dermatology after upload', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(SKIN_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await expect(banner).toContainText('2023-07-10')
    await expect(banner).toContainText(/Dermatology/i)
  })

  test('TC-AC3-06 — accepting skin clinic creates clinic record', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(SKIN_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    await page.getByTestId('clinic-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await page.goto('/clinics')
    await expect(page.getByText(/ClearSkin Dermatology Clinic/i)).toBeVisible({ timeout: 10_000 })
  })

  // ── Neurology ────────────────────────────────────────────────────────────

  test('TC-AC3-07 — neurology tags Neurology / referral / 2019-11-21 in review step', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(NEURO_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: 'Neurology' })).toBeVisible()
    await expect(pills.filter({ hasText: 'referral' })).toBeVisible()
    await expect(pills.filter({ hasText: '2019-11-21' })).toBeVisible()
  })

  test('TC-AC3-08 — neurology clinic card shows National Hospital for Neurology', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(NEURO_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('clinic-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText(/National Hospital for Neurology/i)
  })

  test('TC-AC3-09 — neurology has no appointment suggestion (null in mock)', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(NEURO_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByTestId('appt-suggestion-banner')).not.toBeVisible({ timeout: 5_000 })
  })

  // ── Gynaecology ──────────────────────────────────────────────────────────

  test('TC-AC3-10 — gynaecology contact suggestion Dr Helen Moore visible in review step', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GYNAEC_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const card = page.getByTestId('contact-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText(/Dr Helen Moore/i)
  })

  test('TC-AC3-11 — gynaecology tags Gynaecology / invoice / 2023-04-05 in review step', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GYNAEC_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const pills = page.getByTestId('tag-chip')
    await expect(pills.filter({ hasText: 'Gynaecology' })).toBeVisible()
    await expect(pills.filter({ hasText: 'invoice' })).toBeVisible()
    await expect(pills.filter({ hasText: '2023-04-05' })).toBeVisible()
  })

  test('TC-AC3-12 — gynaecology appointment banner shows 2023-04-05 / Gynaecology', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(GYNAEC_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await expect(banner).toContainText('2023-04-05')
    await expect(banner).toContainText(/Gynaecology/i)
  })

  // ── Batch ────────────────────────────────────────────────────────────────

  test('TC-AC3-13 — uploading all 3 in sequence yields ≥3 new document rows', async ({
    page,
  }) => {
    await page.goto('/documents')
    const initialCount = await page.getByTestId('document-card').count()

    for (const pdf of [SKIN_PDF, NEURO_PDF, GYNAEC_PDF]) {
      await page.getByRole('button', { name: /upload/i }).click()
      await page.locator('input[type="file"]:not([webkitdirectory])').setInputFiles(pdf)
      await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
      await page.getByRole('button', { name: /confirm upload/i }).click()
      await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
        timeout: 10_000,
      })
    }

    const finalCount = await page.getByTestId('document-card').count()
    expect(finalCount).toBeGreaterThanOrEqual(initialCount + 3)
  })
})
