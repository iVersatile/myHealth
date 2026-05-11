/**
 * Focused E2E tests for the IconRail component (Phase 52).
 * Run with NEXT_PUBLIC_REDESIGN_A=true:
 *   NEXT_PUBLIC_REDESIGN_A=true npx playwright test e2e/redesign-A-icon-rail.spec.ts
 */
import { test, expect } from './fixtures'

test.describe('Redesign-A — IconRail', () => {
  test('nav-rail is visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('nav-rail')).toBeVisible()
  })

  test('clicking Documents link navigates to /documents', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('nav-rail').getByRole('link', { name: 'Documents' }).click()
    await expect(page).toHaveURL(/\/documents/)
  })

  test('sidebar (nav-sidebar) is not rendered when REDESIGN_A flag is on', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('nav-sidebar')).not.toBeVisible()
  })
})
