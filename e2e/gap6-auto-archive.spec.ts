import { test, expect } from './fixtures'

const ARCHIVED_CAT_NAME = 'OldPhysioArchived'

test.describe('Gap 6 — Auto-archive show/hide toggle', () => {
  test('TC-GAP6-01 — archived category hidden by default, shown after toggle', async ({ page }) => {
    // Navigate first to initialise sessionStorage
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    // Inject an archived category directly into mock state
    await page.evaluate((catName) => {
      const STATE_KEY = 'tauri_mock_state'
      const raw = sessionStorage.getItem(STATE_KEY)
      const state = raw
        ? JSON.parse(raw)
        : { documents: [], contacts: [], clinics: [], appointments: [], notes: [], categories: [], trash: [] }
      state.categories.push({
        id: 'archived-cat-test-1',
        name: catName,
        color: '#6B7280',
        color_hex: '#6B7280',
        is_archived: true,
        is_system: false,
        sort_order: 99,
        created_at: new Date().toISOString(),
        _deleted: false,
      })
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
    }, ARCHIVED_CAT_NAME)

    // Reload to have the page pick up fresh state
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Archived category must NOT appear before toggle is clicked
    await expect(page.getByText(ARCHIVED_CAT_NAME)).not.toBeVisible({ timeout: 8_000 })

    // Click "Show archived categories" toggle
    await page.getByLabel('Show archived categories').click()

    // Archived category should now appear with 'archived' badge
    await expect(page.getByText(ARCHIVED_CAT_NAME)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('archived').first()).toBeVisible({ timeout: 5_000 })
  })
})
