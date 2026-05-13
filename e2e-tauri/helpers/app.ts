import { execSync } from 'child_process'
import path from 'path'

const DB_PATH =
  process.env.MYHEALTH_TEST_DB ??
  path.resolve(__dirname, '../../src-tauri/tests/fixtures/test.db')

export async function resetDb(): Promise<void> {
  execSync(`sqlite3 "${DB_PATH}" ".read src-tauri/tests/fixtures/seed.sql"`, {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'pipe',
  })
}

export async function waitForApp(): Promise<void> {
  await browser.waitUntil(
    async () => {
      try {
        const title = await browser.getTitle()
        return title.length > 0
      } catch {
        return false
      }
    },
    { timeout: 15_000, interval: 500, timeoutMsg: 'App did not load in 15s' }
  )
}
