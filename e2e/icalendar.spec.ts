import { test, expect } from './fixtures'

test.describe('Phase 104 — iCalendar import/export', () => {
  test('TC-104-01 — import and export buttons are visible on appointments page', async ({ page }) => {
    await page.goto('/appointments')
    await expect(page.getByTestId('import-ics-btn')).toBeVisible()
    await expect(page.getByTestId('export-ics-btn')).toBeVisible()
  })
})
