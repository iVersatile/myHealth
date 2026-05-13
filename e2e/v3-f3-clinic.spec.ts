import { test, expect } from './fixtures'

const PHYSIO_MOCK_PDF = 'src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf'

test.describe('V3-F3 — Clinic Extraction with Company Registration Number', () => {
  test('TC-V3-F3-01 — clinic suggestion card shows name, company registration number, and all addresses', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const card = page.getByTestId('clinic-suggestion-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('JOHN GREEN PHYSIOTHERAPY LTD')
    await expect(card).toContainText('6780032')
    const addresses = card.getByTestId('clinic-address-item')
    await expect(addresses).toHaveCount(3)
  })

  test('TC-V3-F3-02 — saving clinic creates record with company reg and three addresses', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    await page.getByTestId('clinic-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/clinics')
    await page.getByTestId('clinic-row').filter({ hasText: 'JOHN GREEN PHYSIOTHERAPY LTD' }).getByRole('button').first().click()
    await expect(page.getByText('6780032')).toBeVisible()
    const addresses = page.getByTestId('clinic-address-item')
    await expect(addresses).toHaveCount(3)
  })

  test('TC-V3-F3-03 — saved clinic and saved contact are linked together', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    await page.getByTestId('contact-suggestion-save').click()
    await page.getByTestId('clinic-suggestion-save').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/contacts')
    await page.getByTestId('contact-list-item').filter({ hasText: 'John Green' }).click()
    await expect(page.getByText('JOHN GREEN PHYSIOTHERAPY LTD')).toBeVisible()
  })

  test('TC-V3-F3-04 — company registration number extracted from "Company Registration No: XXXXXXXX" pattern', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const regField = page.getByTestId('clinic-suggestion-reg-number')
    await expect(regField).toHaveValue('6780032')
  })

  test('TC-V3-F3-05 — no duplicate clinic created if clinic already exists', async ({ page }) => {
    // Pre-seed a clinic with the same name in mock state so duplicate detection fires
    await page.goto('/documents')
    await page.evaluate(() => {
      const state = JSON.parse(sessionStorage.getItem('tauri_mock_state') ?? '{}')
      state.clinics = state.clinics ?? []
      state.clinics.push({
        id: 'preset-clinic-1',
        name: 'JOHN GREEN PHYSIOTHERAPY LTD',
        address: null,
        phone: null,
        created_at: new Date().toISOString(),
        company_registration_number: '6780032',
        linked_contacts: [],
      })
      sessionStorage.setItem('tauri_mock_state', JSON.stringify(state))
    })

    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    await expect(page.getByTestId('clinic-suggestion-merge')).toBeVisible()
  })

  test('TC-V3-F3-06 — dismissing clinic suggestion does not create clinic', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(PHYSIO_MOCK_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    await page.getByTestId('clinic-suggestion-dismiss').click()
    await page.getByRole('button', { name: /confirm upload/i }).click()

    await page.goto('/contacts')
    await expect(page.getByText('JOHN GREEN PHYSIOTHERAPY LTD')).not.toBeVisible()
  })
})
