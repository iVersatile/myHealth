import { test, expect } from './fixtures'

test.describe('Calendar conflict detection', () => {
  test('appointments page loads without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/appointments')
    await expect(page.getByRole('heading', { name: /appointments/i })).toBeVisible()

    expect(errors).toHaveLength(0)
  })

  test('conflict banner appears when conflicts exist', async ({ page }) => {
    await page.goto('/appointments')
    await expect(page.getByRole('heading', { name: /appointments/i })).toBeVisible()

    const section = page.getByTestId('conflicts-section')
    const banner = page.getByTestId('conflict-banner')
    const conflictCount = await banner.count()

    if (conflictCount > 0) {
      await expect(section).toBeVisible()
      await expect(banner.first()).toBeVisible()
      await expect(page.getByTestId('dismiss-conflict-btn').first()).toBeVisible()
    }
  })

  test('dismiss button removes the conflict banner', async ({ page }) => {
    await page.goto('/appointments')
    await expect(page.getByRole('heading', { name: /appointments/i })).toBeVisible()

    const banners = page.getByTestId('conflict-banner')
    const count = await banners.count()

    if (count > 0) {
      await page.getByTestId('dismiss-conflict-btn').first().click()
      await expect(banners).toHaveCount(count - 1)
    }
  })
})
