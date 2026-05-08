import { test, expect } from './fixtures'

const STATE_KEY = 'tauri_mock_state'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

test.describe('Content search — multi-type results', () => {
  test('TC-CS-MT-01: note indexed by content search', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(({ key, id }) => {
      const raw = sessionStorage.getItem(key)
      const state = raw ? JSON.parse(raw) : {}
      if (!state.notes) state.notes = []
      state.notes.push({
        id,
        title: 'Annual checkup notes',
        content: 'Routine annual checkup — all results normal.',
        tags: [],
        pinned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _deleted: false,
      })
      sessionStorage.setItem(key, JSON.stringify(state))
    }, { key: STATE_KEY, id: uid() })

    await page.goto('/content-search')
    const input = page.getByTestId('content-search-input')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('checkup')
    await input.press('Enter')

    await expect(page.getByText('Annual checkup notes')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('summary-bar')).toBeVisible()
    await expect(page.getByText('Note').first()).toBeVisible()
  })

  test('TC-CS-MT-02: symptom indexed by content search', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(({ key, id }) => {
      const raw = sessionStorage.getItem(key)
      const state = raw ? JSON.parse(raw) : {}
      if (!state.symptoms) state.symptoms = []
      state.symptoms.push({
        id,
        name: 'Migraine',
        severity: 8,
        onset_date: null,
        notes: 'Recurring migraine with aura',
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      sessionStorage.setItem(key, JSON.stringify(state))
    }, { key: STATE_KEY, id: uid() })

    await page.goto('/content-search')
    const input = page.getByTestId('content-search-input')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('migraine')
    await input.press('Enter')

    await expect(page.getByText('Migraine')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('summary-bar')).toBeVisible()
    await expect(page.getByText('Symptom').first()).toBeVisible()
  })

  test('TC-CS-MT-03: medication indexed by content search', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(({ key, id }) => {
      const raw = sessionStorage.getItem(key)
      const state = raw ? JSON.parse(raw) : {}
      if (!state.medications) state.medications = []
      state.medications.push({
        id,
        name: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'Three times daily',
        start_date: null,
        end_date: null,
        notes: 'Amoxicillin course for ear infection',
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      sessionStorage.setItem(key, JSON.stringify(state))
    }, { key: STATE_KEY, id: uid() })

    await page.goto('/content-search')
    const input = page.getByTestId('content-search-input')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('amoxicillin')
    await input.press('Enter')

    await expect(page.getByText('Amoxicillin')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('summary-bar')).toBeVisible()
    await expect(page.getByText('Medication').first()).toBeVisible()
  })

  test('TC-CS-MT-04: mixed results show correct type badges', async ({ page }) => {
    const noteId = uid()
    const symId = uid()
    const medId = uid()

    await page.goto('/')
    await page.evaluate(({ key, noteId, symId, medId }) => {
      const raw = sessionStorage.getItem(key)
      const state = raw ? JSON.parse(raw) : {}
      state.notes = (state.notes || []).concat([{
        id: noteId,
        title: 'health record',
        content: 'General health record entry',
        tags: [],
        pinned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _deleted: false,
      }])
      state.symptoms = (state.symptoms || []).concat([{
        id: symId,
        name: 'health anxiety',
        severity: null,
        onset_date: null,
        notes: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      state.medications = (state.medications || []).concat([{
        id: medId,
        name: 'health supplement',
        dosage: null,
        frequency: null,
        start_date: null,
        end_date: null,
        notes: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      sessionStorage.setItem(key, JSON.stringify(state))
    }, { key: STATE_KEY, noteId, symId, medId })

    await page.goto('/content-search')
    const input = page.getByTestId('content-search-input')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('health')
    await input.press('Enter')

    await expect(page.getByTestId('summary-bar')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Note').first()).toBeVisible()
    await expect(page.getByText('Symptom').first()).toBeVisible()
    await expect(page.getByText('Medication').first()).toBeVisible()
  })
})
