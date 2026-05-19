import { test, expect } from './fixtures'

async function seedCategories(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const STATE_KEY = 'tauri_mock_state'
    const state = {
      documents: [],
      contacts: [],
      clinics: [],
      appointments: [],
      notes: [],
      categories: [
        { id: 'cat-alpha', name: 'Alpha', color_hex: '#ef4444', sort_order: 0, is_system: false, _deleted: false },
        { id: 'cat-beta', name: 'Beta', color_hex: '#3b82f6', sort_order: 1, is_system: false, _deleted: false },
        { id: 'cat-gamma', name: 'Gamma', color_hex: '#22c55e', sort_order: 2, is_system: false, _deleted: false },
      ],
      trash: [],
    }
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
  })
}

async function dragTo(
  page: import('@playwright/test').Page,
  sourceLocator: import('@playwright/test').Locator,
  targetLocator: import('@playwright/test').Locator,
) {
  await sourceLocator.scrollIntoViewIfNeeded()
  await targetLocator.scrollIntoViewIfNeeded()
  // Scroll source back into view (target scroll may have moved it)
  await sourceLocator.scrollIntoViewIfNeeded()

  const source = await sourceLocator.boundingBox()
  const target = await targetLocator.boundingBox()
  if (!source || !target) throw new Error('Could not get bounding box for drag')

  const sx = source.x + source.width / 2
  const sy = source.y + source.height / 2
  const tx = target.x + target.width / 2
  const ty = target.y + target.height / 2

  await page.mouse.move(sx, sy)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(sx + (tx - sx) * (i / 20), sy + (ty - sy) * (i / 20))
  }
  await page.mouse.up()
}

async function gotoSettings(page: import('@playwright/test').Page) {
  // Navigate to /documents first, then click the Settings sidebar link for
  // client-side routing — avoids SSR crash on direct page.goto('/settings')
  await page.goto('/documents')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.waitForLoadState('networkidle')
}

test.describe('V3-F3 — Category drag-to-reorder', () => {
  test('TC-F3CAT-01 — drag list renders with reorder hint', async ({ page }) => {
    await seedCategories(page)
    await gotoSettings(page)

    await expect(page.getByText('Drag to reorder categories')).toBeVisible()
    await expect(page.getByText('Alpha')).toBeVisible()
    await expect(page.getByText('Beta')).toBeVisible()
    await expect(page.getByText('Gamma')).toBeVisible()
  })

  test('TC-F3CAT-02 — drag reorders categories in the UI', async ({ page }) => {
    await seedCategories(page)
    await gotoSettings(page)

    await expect(page.getByText('Drag to reorder categories')).toBeVisible()

    const alphaEl = page.getByRole('button', { name: /Alpha/ })
    const gammaEl = page.getByRole('button', { name: /Gamma/ })
    await dragTo(page, alphaEl, gammaEl)

    // All three categories still present
    const allNames = await page.locator('text=/^(Alpha|Beta|Gamma)$/').allTextContents()
    expect(allNames).toHaveLength(3)
    // Alpha dragged down — should no longer be first
    expect(allNames[0]).not.toBe('Alpha')
  })

  test('TC-F3CAT-03 — categories_reorder IPC called after drag', async ({ page }) => {
    await seedCategories(page)

    const reorderCalls: unknown[] = []
    await page.exposeFunction('__recordReorder', (args: unknown) => {
      reorderCalls.push(args)
    })

    await gotoSettings(page)

    // Patch __TAURI_INTERNALS__.invoke to intercept categories_reorder
    await page.evaluate(() => {
      type TauriInternals = { invoke: (...a: unknown[]) => unknown }
      type Win = Window & { __TAURI_INTERNALS__?: TauriInternals; __recordReorder?: (a: unknown) => void }
      const win = window as Win
      const orig = win.__TAURI_INTERNALS__?.invoke
      if (!orig) return
      win.__TAURI_INTERNALS__!.invoke = (...args: unknown[]) => {
        if (args[0] === 'categories_reorder') {
          void win.__recordReorder?.(args[1])
        }
        return orig(...args)
      }
    })

    await expect(page.getByText('Drag to reorder categories')).toBeVisible()

    const alphaEl = page.getByRole('button', { name: /Alpha/ })
    const gammaEl = page.getByRole('button', { name: /Gamma/ })
    await dragTo(page, alphaEl, gammaEl)

    await expect.poll(() => reorderCalls.length).toBeGreaterThanOrEqual(1)
  })
})
