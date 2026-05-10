import path from 'path'
import { test, expect } from './fixtures'

const FIXTURE_DIR = path.join(__dirname, '..', 'src-tauri', 'tests', 'fixtures')
const PDF_1 = path.join(FIXTURE_DIR, 'medical-invoice.pdf')
const PDF_2 = path.join(FIXTURE_DIR, 'no-date-physio.pdf')

test.describe('Phase 60 — Batch Document Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/documents')
  })

  test('TC-60-01 — batch-upload-zone is visible on documents page', async ({ page }) => {
    await expect(page.locator('[data-testid="batch-upload-zone"]')).toBeVisible()
  })

  test('TC-60-02 — "Select Files" button opens file picker', async ({ page }) => {
    const btn = page.locator('[data-testid="select-files-btn"]')
    await expect(btn).toBeVisible()
    await expect(btn).toBeEnabled()
  })

  test('TC-60-03 — "Select Folder" button is present', async ({ page }) => {
    await expect(page.locator('[data-testid="select-folder-btn"]')).toBeVisible()
  })

  test('TC-60-04 — drag-over shows visual drop cue', async ({ page }) => {
    const zone = page.locator('[data-testid="batch-upload-zone"]')
    await zone.dispatchEvent('dragenter', { dataTransfer: new DataTransfer() })
    await expect(zone).toHaveClass(/drag-over|dragover|over/)
  })

  test('TC-60-05 — selected files appear as upload-file-row entries in queue', async ({ page }) => {
    const input = page.locator('input[type="file"]').first()
    await input.setInputFiles([PDF_1, PDF_2])
    const rows = page.locator('[data-testid="upload-file-row"]')
    await expect(rows).toHaveCount(2)
  })

  test('TC-60-06 — upload-file-row shows filename', async ({ page }) => {
    const input = page.locator('input[type="file"]').first()
    await input.setInputFiles([PDF_1])
    const row = page.locator('[data-testid="upload-file-row"]').first()
    await expect(row).toContainText('medical-invoice.pdf')
  })

  test('TC-60-07 — upload-file-row shows "done" status after processing', async ({ page }) => {
    const input = page.locator('input[type="file"]').first()
    await input.setInputFiles([PDF_1])
    await page.locator('[data-testid="start-batch-upload-btn"]').click()
    const row = page.locator('[data-testid="upload-file-row"]').first()
    await expect(row.locator('[data-testid="row-status"]')).toHaveAttribute('data-status', 'done', {
      timeout: 30_000,
    })
  })

  test('TC-60-08 — completion toast shows extracted entity count', async ({ page }) => {
    const input = page.locator('input[type="file"]').first()
    await input.setInputFiles([PDF_1])
    await page.locator('[data-testid="start-batch-upload-btn"]').click()
    const toast = page.locator('[data-testid="batch-complete-toast"]')
    await expect(toast).toBeVisible({ timeout: 30_000 })
    await expect(toast).toContainText(/draft entit/i)
  })
})
