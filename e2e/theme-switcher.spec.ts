import { test, expect } from './fixtures'

test.describe('Phase 103 — Theme Switcher', () => {
  test('TC-103-01 — clicking Coffee swatch applies theme-coffee class to <html>', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForSelector('[data-testid="theme-picker"]')

    await page.getByTestId('theme-option-coffee').click()

    const htmlClass = await page.evaluate(() => document.documentElement.className)
    expect(htmlClass).toContain('theme-coffee')
  })

  test('TC-103-02 — theme persists across page reload', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForSelector('[data-testid="theme-picker"]')

    await page.getByTestId('theme-option-mint').click()

    await page.reload()
    await page.waitForSelector('[data-testid="theme-picker"]')

    const htmlClass = await page.evaluate(() => document.documentElement.className)
    expect(htmlClass).toContain('theme-mint')
  })

  test('TC-103-03 — active swatch has aria-pressed=true', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForSelector('[data-testid="theme-picker"]')

    await page.getByTestId('theme-option-coffee').click()

    const pressed = await page.getByTestId('theme-option-coffee').getAttribute('aria-pressed')
    expect(pressed).toBe('true')

    const otherPressed = await page.getByTestId('theme-option-calm').getAttribute('aria-pressed')
    expect(otherPressed).toBe('false')
  })
})
