import { test, expect } from './fixtures'

test.describe('Phase 60 — Batch Document Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/documents')
    await page.locator('[data-testid="upload-btn"]').click()
    await page.locator('[data-testid="batch-upload-zone"]').waitFor({ state: 'visible' })
  })

  test('TC-60-01 — batch-upload-zone is visible after opening dialog', async ({ page }) => {
    await expect(page.locator('[data-testid="batch-upload-zone"]')).toBeVisible()
  })

  test('TC-60-02 — "Select Files" button is present and enabled', async ({ page }) => {
    const btn = page.locator('[data-testid="select-files-btn"]')
    await expect(btn).toBeVisible()
    await expect(btn).toBeEnabled()
  })

  test('TC-60-03 — "Select Folder" button is present', async ({ page }) => {
    await expect(page.locator('[data-testid="select-folder-btn"]')).toBeVisible()
  })

  test.skip('TC-60-04 — drag-over shows visual drop cue', async ({ page }) => {
    // Requires real file DataTransfer types; not reliably simulatable in web-only E2E
    void page
  })

  test.skip('TC-60-05 — selected files appear as upload-file-row entries in queue', async ({ page }) => {
    // file.path is undefined in browser — handlePaths() not called; requires Tauri file picker
    void page
  })

  test.skip('TC-60-06 — upload-file-row shows filename', async ({ page }) => {
    // file.path is undefined in browser — requires Tauri file picker
    void page
  })

  test.skip('TC-60-07 — upload-file-row shows "done" status after processing', async ({ page }) => {
    // Requires real Tauri invoke (upload_document) — not available in web-only E2E
    void page
  })

  test.skip('TC-60-08 — completion toast shows extracted entity count', async ({ page }) => {
    // Requires real Tauri invoke — not available in web-only E2E
    void page
  })
})
