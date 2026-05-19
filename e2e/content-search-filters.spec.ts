import { test, expect } from './fixtures'

const STATE_KEY = 'tauri_mock_state'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

test.describe('Content search — entity-type filter chips + date range', () => {
  test('TC-CSF-01: Document chip filters out note results', async ({ page }) => {
    const docId = uid()
    const noteId = uid()

    await page.goto('/')
    await page.evaluate(({ key, docId, noteId }) => {
      const raw = sessionStorage.getItem(key)
      const state = raw ? JSON.parse(raw) : {}
      state.documents = (state.documents || []).concat([{
        id: docId,
        filename: 'bloodwork.pdf',
        title: 'bloodwork report',
        extracted_text: 'routine bloodwork results',
        activity_date: '2024-03-01',
        _deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      state.notes = (state.notes || []).concat([{
        id: noteId,
        title: 'bloodwork note',
        content: 'doctor discussed bloodwork results with me',
        tags: [],
        pinned: false,
        _deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      sessionStorage.setItem(key, JSON.stringify(state))
    }, { key: STATE_KEY, docId, noteId })

    await page.goto('/content-search')
    const input = page.getByTestId('content-search-input')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('bloodwork')
    await input.press('Enter')

    await expect(page.getByTestId('summary-bar')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('bloodwork report')).toBeVisible()
    await expect(page.getByText('bloodwork note')).toBeVisible()

    await page.getByTestId('chip-document').click()

    await expect(page.getByText('bloodwork report')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('bloodwork note')).not.toBeVisible()
    await expect(page.getByTestId('summary-bar')).toContainText('Filtered results')
  })

  test('TC-CSF-02: All chip clears entity filter and restores all results', async ({ page }) => {
    const docId = uid()
    const noteId = uid()

    await page.goto('/')
    await page.evaluate(({ key, docId, noteId }) => {
      const raw = sessionStorage.getItem(key)
      const state = raw ? JSON.parse(raw) : {}
      state.documents = (state.documents || []).concat([{
        id: docId,
        filename: 'xray.pdf',
        title: 'xray scan',
        extracted_text: 'xray scan report',
        activity_date: '2024-04-01',
        _deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      state.notes = (state.notes || []).concat([{
        id: noteId,
        title: 'xray note',
        content: 'xray results discussed',
        tags: [],
        pinned: false,
        _deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      sessionStorage.setItem(key, JSON.stringify(state))
    }, { key: STATE_KEY, docId, noteId })

    await page.goto('/content-search')
    const input = page.getByTestId('content-search-input')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('xray')
    await input.press('Enter')

    await expect(page.getByTestId('summary-bar')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('chip-document').click()
    await expect(page.getByText('xray note')).not.toBeVisible()

    await page.getByTestId('chip-all').click()

    await expect(page.getByText('xray scan')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('xray note')).toBeVisible()
    await expect(page.getByTestId('summary-bar')).not.toContainText('Filtered results')
  })

  test('TC-CSF-03: date range excludes document outside range', async ({ page }) => {
    const doc2022Id = uid()
    const doc2024Id = uid()

    await page.goto('/')
    await page.evaluate(({ key, doc2022Id, doc2024Id }) => {
      const raw = sessionStorage.getItem(key)
      const state = raw ? JSON.parse(raw) : {}
      state.documents = (state.documents || []).concat([
        {
          id: doc2022Id,
          filename: 'checkup-2022.pdf',
          title: 'checkup 2022',
          extracted_text: 'annual checkup visit',
          activity_date: '2022-06-15',
          _deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: doc2024Id,
          filename: 'checkup-2024.pdf',
          title: 'checkup 2024',
          extracted_text: 'annual checkup visit',
          activity_date: '2024-06-15',
          _deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      sessionStorage.setItem(key, JSON.stringify(state))
    }, { key: STATE_KEY, doc2022Id, doc2024Id })

    await page.goto('/content-search')
    const input = page.getByTestId('content-search-input')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('checkup')
    await input.press('Enter')

    await expect(page.getByTestId('summary-bar')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('checkup 2022')).toBeVisible()
    await expect(page.getByText('checkup 2024')).toBeVisible()

    await page.getByTestId('date-from').fill('2024-01-01')
    await page.getByTestId('date-from').press('Enter')

    await expect(page.getByText('checkup 2024')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('checkup 2022')).not.toBeVisible()
    await expect(page.getByTestId('summary-bar')).toContainText('Filtered results')
  })

  test('TC-CSF-04: Clear dates button resets date filter and restores all results', async ({ page }) => {
    const doc2022Id = uid()
    const doc2024Id = uid()

    await page.goto('/')
    await page.evaluate(({ key, doc2022Id, doc2024Id }) => {
      const raw = sessionStorage.getItem(key)
      const state = raw ? JSON.parse(raw) : {}
      state.documents = (state.documents || []).concat([
        {
          id: doc2022Id,
          filename: 'invoice-2022.pdf',
          title: 'invoice 2022',
          extracted_text: 'medical invoice payment',
          activity_date: '2022-11-10',
          _deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: doc2024Id,
          filename: 'invoice-2024.pdf',
          title: 'invoice 2024',
          extracted_text: 'medical invoice payment',
          activity_date: '2024-11-10',
          _deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      sessionStorage.setItem(key, JSON.stringify(state))
    }, { key: STATE_KEY, doc2022Id, doc2024Id })

    await page.goto('/content-search')
    const input = page.getByTestId('content-search-input')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('invoice')
    await input.press('Enter')

    await expect(page.getByTestId('summary-bar')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('date-from').fill('2024-01-01')
    await page.getByTestId('date-from').press('Enter')
    await expect(page.getByText('invoice 2022')).not.toBeVisible()

    await expect(page.getByTestId('clear-dates')).toBeVisible()
    await page.getByTestId('clear-dates').click()

    await expect(page.getByText('invoice 2022')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('invoice 2024')).toBeVisible()
    await expect(page.getByTestId('clear-dates')).not.toBeVisible()
  })
})
