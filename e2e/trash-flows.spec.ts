import { test, expect } from './fixtures'

const MEDICAL_INVOICE = 'src-tauri/tests/fixtures/medical-invoice.pdf'

async function uploadDoc(page: import('@playwright/test').Page, file: string) {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  await page.locator('input[type="file"]').setInputFiles(file)
  await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
  await page.getByRole('button', { name: /confirm upload/i }).click()
  await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('document-card').first()).toBeVisible({ timeout: 10_000 })
}

async function deleteFirstDoc(page: import('@playwright/test').Page) {
  const card = page.getByTestId('document-card').first()
  await card.getByRole('link', { name: /view/i }).click()
  await page.waitForSelector('button:has-text("Delete")', { timeout: 10_000 })
  await page.getByRole('button', { name: /^delete$/i }).click()
  await expect(page).toHaveURL(/\/documents/, { timeout: 10_000 })
}

test.describe('Trash flows', () => {
  test('TC-TRASH-01 — restore: deleted doc reappears in document list', async ({ page }) => {
    await uploadDoc(page, MEDICAL_INVOICE)
    await deleteFirstDoc(page)

    await page.goto('/trash')
    await expect(page.getByTestId('trash-restore-btn').first()).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('trash-restore-btn').first().click()

    await page.goto('/documents')
    await expect(page.getByTestId('document-card').first()).toBeVisible({ timeout: 10_000 })
  })

  test('TC-TRASH-02 — delete permanently: doc gone from trash', async ({ page }) => {
    await uploadDoc(page, MEDICAL_INVOICE)
    await deleteFirstDoc(page)

    await page.goto('/trash')
    await expect(page.getByTestId('trash-delete-permanently-btn').first()).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('trash-delete-permanently-btn').first().click()

    await expect(page.getByTestId('trash-delete-permanently-btn')).not.toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Trash is empty')).toBeVisible({ timeout: 5_000 })
  })

  test('TC-TRASH-03 — empty trash: all items removed', async ({ page }) => {
    await uploadDoc(page, MEDICAL_INVOICE)
    await deleteFirstDoc(page)

    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(MEDICAL_INVOICE)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('document-card').first()).toBeVisible({ timeout: 10_000 })
    await deleteFirstDoc(page)

    await page.goto('/trash')
    await expect(page.getByTestId('trash-empty-btn')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('trash-empty-btn').click()

    await page.getByRole('button', { name: /delete all/i }).click()
    await expect(page.locator('text=Trash is empty')).toBeVisible({ timeout: 5_000 })
  })
})
