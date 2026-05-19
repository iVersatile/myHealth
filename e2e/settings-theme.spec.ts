import { test, expect } from './fixtures'

test.describe('Settings page', () => {
  test('TC-SET-01: settings page renders theme and auto-lock controls', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('radio', { name: /light/i })).toBeVisible()
    await expect(page.getByRole('radio', { name: /dark/i })).toBeVisible()
    await expect(page.getByRole('radio', { name: /system/i })).toBeVisible()
    await expect(page.locator('#auto-lock')).toBeVisible()
  })

  test('TC-SET-02: selecting dark theme sets data-theme="dark" on html element', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('radio', { name: /dark/i }).click()
    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    )
    expect(dataTheme).toBe('dark')
  })

  test('TC-SET-03: auto-lock select reflects pre-seeded settings state on load', async ({ page }) => {
    // Seed settings state before navigation (runs after the fixture clear script)
    await page.addInitScript(() => {
      const s = JSON.parse(sessionStorage.getItem('tauri_mock_state') || '{}')
      s.settings = { auto_lock_minutes: '5' }
      sessionStorage.setItem('tauri_mock_state', JSON.stringify(s))
    })
    await page.goto('/settings')
    await expect(page.locator('#auto-lock')).toHaveValue('5')
  })
})
