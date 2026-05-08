import { test, expect } from './fixtures'

// TC-SYM-01: create symptom → appears in list
test('TC-SYM-01: log symptom with severity and see it in list', async ({ page }) => {
  await page.goto('/symptoms')
  await page.getByRole('button', { name: /log symptom/i }).first().click()

  await expect(page).toHaveURL('/symptoms/new')

  await page.getByPlaceholder(/e\.g\. headache/i).fill('Headache')

  // Enable severity rating
  await page.getByRole('checkbox', { name: /rate severity/i }).check()

  // Set slider to 7
  const slider = page.getByRole('slider')
  await slider.fill('7')

  await page.getByRole('button', { name: /save/i }).click()

  // Redirected back to list
  await expect(page).toHaveURL('/symptoms')

  // Card shows the symptom name
  await expect(page.getByText('Headache')).toBeVisible()

  // Severity badge shows 7/10
  await expect(page.getByText(/7\/10/)).toBeVisible()
})

// TC-MED-01: create medication → appears in list
test('TC-MED-01: add medication with dosage and see it in list', async ({ page }) => {
  await page.goto('/medications')
  await page.getByRole('button', { name: /add medication/i }).first().click()

  await expect(page).toHaveURL('/medications/new')

  await page.getByPlaceholder(/e\.g\. ibuprofen/i).fill('Ibuprofen 400mg')
  await page.getByPlaceholder(/e\.g\. 400mg/i).fill('400mg')
  await page.getByPlaceholder(/e\.g\. twice daily/i).fill('As needed')

  await page.getByRole('button', { name: /save/i }).click()

  await expect(page).toHaveURL('/medications')

  await expect(page.getByText('Ibuprofen 400mg')).toBeVisible()
})

// TC-LINK-01: link symptom to document → chip visible on document detail
test('TC-LINK-01: link symptom to document and verify chip on detail page', async ({ page }) => {
  // Seed a document + symptom directly into mock state before navigating
  await page.goto('/')
  await page.evaluate(() => {
    const STATE_KEY = 'tauri_mock_state'
    const now = new Date().toISOString()
    const docId = 'doc-link-test-01'
    const symId = 'sym-link-test-01'
    sessionStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        documents: [
          {
            id: docId,
            filename: 'sample.pdf',
            file_path: '/tmp/sample.pdf',
            title: 'sample',
            mime_type: 'application/pdf',
            tags: [],
            category_id: null,
            category_name: null,
            clinic_id: null,
            clinic_name: null,
            activity_date: '2024-01-15',
            extracted_text: null,
            created_at: now,
            updated_at: now,
            _extraction: { contact_suggestions: [], clinic_suggestions: [], category_suggestion: null, document_tags: [], auto_tags: [], doctor_candidates: [], activity_date: '2024-01-15', appointment_suggestion: null },
            _entities: [],
            _deleted: false,
          },
        ],
        contacts: [],
        clinics: [],
        appointments: [],
        notes: [],
        categories: [],
        trash: [],
        symptoms: [
          {
            id: symId,
            name: 'Headache',
            severity: 7,
            onset_date: null,
            notes: null,
            deleted_at: null,
            created_at: now,
            updated_at: now,
          },
        ],
        medications: [],
        entity_links: [],
      })
    )
  })

  // Navigate to document detail
  await page.goto('/documents/view/doc-link-test-01')
  await expect(page.getByText('sample')).toBeVisible()

  // Find "Linked symptoms" section
  await expect(page.getByText(/linked symptoms/i)).toBeVisible()

  // Select the symptom in the dropdown and click Link
  const symSelect = page.locator('select[aria-label*="symptom" i], select').filter({ hasText: /headache/i })
  if (await symSelect.count() === 0) {
    // Fallback: select the last select element in the Linked Symptoms section
    const selects = page.locator('select')
    const count = await selects.count()
    // Pick the select that contains "Headache" option
    for (let i = 0; i < count; i++) {
      const opts = await selects.nth(i).locator('option').allTextContents()
      if (opts.some((t) => t.includes('Headache'))) {
        await selects.nth(i).selectOption({ label: 'Headache' })
        break
      }
    }
  } else {
    await symSelect.first().selectOption({ label: 'Headache' })
  }

  // Click the Link button near the symptom section
  const linkBtns = page.getByRole('button', { name: /^link$/i })
  await linkBtns.first().click()

  // Chip with symptom name should appear
  await expect(page.getByText('Headache')).toBeVisible()
})
