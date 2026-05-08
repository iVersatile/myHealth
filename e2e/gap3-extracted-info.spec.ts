import { test, expect } from './fixtures'

const MEDICAL_INVOICE = 'src-tauri/tests/fixtures/medical-invoice.pdf'

test.describe('Gap 3 — Extracted Info section on document detail', () => {
  test('TC-GAP3-01 — detail-extracted-info is visible and shows at least one entity group heading', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(MEDICAL_INVOICE)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    const card = page.getByTestId('document-card').first()
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.getByRole('link', { name: /view/i }).click()

    await expect(page.locator('text=Loading')).not.toBeVisible({ timeout: 10_000 })

    const section = page.getByTestId('detail-extracted-info')
    await expect(section).toBeVisible()

    const headings = ['Medications', 'Conditions', 'Lab Results', 'Referrals']
    const anyVisible = await Promise.any(
      headings.map((h) => expect(section.getByText(h)).toBeVisible())
    ).then(() => true).catch(() => false)
    expect(anyVisible).toBe(true)
  })
})
