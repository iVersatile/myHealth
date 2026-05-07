import { test, expect } from './fixtures'

const STATE_KEY = 'tauri_mock_state'

function makeDoc(id: string, filename: string, activityDate: string) {
  return {
    id,
    filename,
    file_path: `/tmp/${filename}`,
    title: filename.replace(/\.pdf$/i, ''),
    mime_type: 'application/pdf',
    tags: [],
    category_id: null,
    category_name: null,
    clinic_id: null,
    clinic_name: null,
    activity_date: activityDate,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    _deleted: false,
  }
}

async function seedDocs(page: import('@playwright/test').Page, docs: ReturnType<typeof makeDoc>[]) {
  await page.goto('/documents')
  await page.evaluate(
    ({ key, docs }) => {
      const raw = sessionStorage.getItem(key)
      const state = raw
        ? JSON.parse(raw)
        : { documents: [], contacts: [], clinics: [], appointments: [], notes: [], categories: [], trash: [] }
      state.documents.push(...docs)
      sessionStorage.setItem(key, JSON.stringify(state))
    },
    { key: STATE_KEY, docs },
  )
  await page.reload()
}

test.describe('Advanced Search Filters', () => {
  test('TC-FILTER-01 — date From filter shows only docs on/after that date', async ({ page }) => {
    const jan = makeDoc('doc-jan', 'january.pdf', '2026-01-15')
    const mar = makeDoc('doc-mar', 'march.pdf', '2026-03-20')
    await seedDocs(page, [jan, mar])

    await page.getByLabel('From').fill('2026-02-01')

    await expect(page.getByText('march.pdf')).toBeVisible()
    await expect(page.getByText('january.pdf')).not.toBeVisible()
  })

  test('TC-FILTER-02 — date To filter shows only docs on/before that date', async ({ page }) => {
    const jan = makeDoc('doc-jan2', 'january2.pdf', '2026-01-15')
    const mar = makeDoc('doc-mar2', 'march2.pdf', '2026-03-20')
    await seedDocs(page, [jan, mar])

    await page.locator('#filter-date-to').fill('2026-02-01')

    await expect(page.getByText('january2.pdf')).toBeVisible()
    await expect(page.getByText('march2.pdf')).not.toBeVisible()
  })

  test('TC-FILTER-03 — Clear button resets filter and shows all docs', async ({ page }) => {
    const jan = makeDoc('doc-jan3', 'january3.pdf', '2026-01-15')
    const mar = makeDoc('doc-mar3', 'march3.pdf', '2026-03-20')
    await seedDocs(page, [jan, mar])

    await page.getByLabel('From').fill('2026-02-01')
    await expect(page.getByText('january3.pdf')).not.toBeVisible()

    await page.getByRole('button', { name: /clear/i }).click()

    await expect(page.getByText('january3.pdf')).toBeVisible()
    await expect(page.getByText('march3.pdf')).toBeVisible()
  })
})
