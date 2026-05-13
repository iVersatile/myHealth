import { test, expect } from '@playwright/test'

test.describe('Multi-user vault — profiles page', () => {
  test('profiles page loads and shows new-profile-btn', async ({ page }) => {
    await page.goto('/profiles')
    await expect(page.getByTestId('new-profile-btn')).toBeVisible()
  })

  test('new-profile-btn navigates to /profiles/new', async ({ page }) => {
    await page.goto('/profiles')
    await page.getByTestId('new-profile-btn').click()
    await expect(page).toHaveURL(/\/profiles\/new/)
  })

  test('profiles/new shows creation form', async ({ page }) => {
    await page.goto('/profiles/new')
    await expect(page.getByLabel('Profile name')).toBeVisible()
    await expect(page.getByLabel(/^Password/)).toBeVisible()
    await expect(page.getByLabel(/Confirm password/)).toBeVisible()
  })
})
