import { test, expect } from './fixtures'

const LONDON_PDF = 'e2e/fixtures/Upload (22Nov2021-13_16_15).pdf'
const CAMBRIDGE_PDF = 'e2e/fixtures/2021-Nov-22_12_34.pdf'

test.describe('London & Cambridge Clinic Invoices', () => {
  // TC-LCC-01 — London Clinic: 6-tag assertion
  test('TC-LCC-01 — London Clinic upload shows expected tags', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"][accept]').setInputFiles(LONDON_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const allTags = await page.getByTestId('tag-chip').allTextContents()
    const tagSet = allTags.map((t) => t.replace(/×/g, '').trim().toLowerCase())

    expect(tagSet).toContain('2021-11-22')
    expect(tagSet).toContain('belgrove cardiac clinic')
    expect(tagSet).toContain('invoice')
    expect(tagSet).toContain('cardiography')
    expect(tagSet).toContain('19/11/21')
    expect(tagSet).toContain('patient account number m24195380/1')
  })

  // TC-LCC-02 — Cambridge Clinic: 2-address clinic card, no contact, accept appointment → count+1
  test('TC-LCC-02 — Cambridge Clinic: clinic card shows 2 addresses, no contact card, appointment banner accepted', async ({
    page,
  }) => {
    await page.goto('/appointments')
    const initialCount = await page.getByTestId('appointment-card').count()

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"][accept]').setInputFiles(CAMBRIDGE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    // Clinic card: 2 addresses
    const clinicCard = page.getByTestId('clinic-suggestion-card')
    await expect(clinicCard).toBeVisible()
    await expect(clinicCard).toContainText('The Cambridge Clinic')
    await expect(clinicCard.getByTestId('clinic-address-item')).toHaveCount(2)
    await expect(clinicCard).toContainText('1 Hills Road')
    await expect(clinicCard).toContainText('Trumpington Street')

    // No contact suggestion
    await expect(page.getByTestId('contact-suggestion-card')).not.toBeVisible()

    // Confirm upload
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    // Appointment banner appears
    const banner = page.getByTestId('appt-suggestion-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })

    // Accept (draft → permanent)
    await banner.getByRole('button', { name: /create appointment/i }).click()
    await expect(banner).not.toBeVisible({ timeout: 8_000 })

    await page.goto('/appointments')
    const finalCount = await page.getByTestId('appointment-card').count()
    expect(finalCount).toBeGreaterThan(initialCount)
  })

  // TC-LCC-03 — Cambridge Clinic: 6-tag assertion
  test('TC-LCC-03 — Cambridge Clinic upload shows expected tags', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"][accept]').setInputFiles(CAMBRIDGE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })

    const allTags = await page.getByTestId('tag-chip').allTextContents()
    const tagSet = allTags.map((t) => t.replace(/×/g, '').trim().toLowerCase())

    expect(tagSet).toContain('2021-11-22')
    expect(tagSet).toContain('the cambridge clinic')
    expect(tagSet).toContain('invoice')
    expect(tagSet).toContain('cardiography')
    expect(tagSet).toContain('19/11/21')
    expect(tagSet).toContain('patient account number :a12345/21')
  })

  // TC-LCC-04 — Batch upload both → batch queue appears → 2 docs processed
  test('TC-LCC-04 — batch upload of both clinic invoices processes 2 documents', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"][accept]').setInputFiles([LONDON_PDF, CAMBRIDGE_PDF])

    // Batch queue renders with 2 rows
    const rows = page.getByTestId('upload-file-row')
    await expect(rows).toHaveCount(2, { timeout: 10_000 })

    // Both rows eventually reach done status
    await expect(rows.nth(0)).toHaveAttribute('data-status', 'done', { timeout: 30_000 })
    await expect(rows.nth(1)).toHaveAttribute('data-status', 'done', { timeout: 30_000 })
  })

  // TC-LCC-05 — Cambridge Clinic: all 6 tags persist on document card after confirm
  test('TC-LCC-05 — Cambridge Clinic tags persist on document card after upload confirmed', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"][accept]').setInputFiles(CAMBRIDGE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    // Return to document list and open the saved document
    await page.goto('/documents')
    await page.getByTestId('document-card').first().click()

    const allTags = await page.getByTestId('tag-chip').allTextContents()
    const tagSet = allTags.map((t) => t.replace(/×/g, '').trim().toLowerCase())

    expect(tagSet).toContain('2021-11-22')
    expect(tagSet).toContain('the cambridge clinic')
    expect(tagSet).toContain('invoice')
    expect(tagSet).toContain('cardiography')
    expect(tagSet).toContain('19/11/21')
    expect(tagSet).toContain('patient account number :a12345/21')
  })

  // TC-LCC-06 — Cambridge Clinic: all 6 tags visible on document detail page
  test('TC-LCC-06 — Cambridge Clinic tags appear on document detail page', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"][accept]').setInputFiles(CAMBRIDGE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({
      timeout: 10_000,
    })

    // Navigate to document detail via View link
    await page.goto('/documents')
    const viewLink = page.getByTestId('document-card').first().getByRole('link', { name: /view/i })
    await viewLink.click()
    await page.waitForURL(/\/documents\/view/, { timeout: 10_000 })

    const allTags = await page.getByTestId('tag-chip').allTextContents()
    const tagSet = allTags.map((t) => t.replace(/×/g, '').trim().toLowerCase())

    expect(tagSet).toContain('2021-11-22')
    expect(tagSet).toContain('the cambridge clinic')
    expect(tagSet).toContain('invoice')
    expect(tagSet).toContain('cardiography')
    expect(tagSet).toContain('19/11/21')
    expect(tagSet).toContain('patient account number :a12345/21')
  })
})
