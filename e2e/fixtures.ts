import { test as base, expect } from '@playwright/test'
import path from 'path'

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript({ path: path.join(__dirname, 'tauri-mock.js') })
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(context)
  },
  page: async ({ page }, use) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page)
  },
})

export { expect }
