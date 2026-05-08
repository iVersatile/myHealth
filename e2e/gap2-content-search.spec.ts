import { test, expect } from './fixtures'

const MEDICAL_INVOICE = 'src-tauri/tests/fixtures/medical-invoice.pdf'

test.describe('Gap 2 — Content Search summary bar', () => {
  test('TC-GAP2-01 — summary-bar shows doc_count ≥ 1 after searching for a keyword present in uploaded doc', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(MEDICAL_INVOICE)
    await page.waitForSelector('[data-testid="upload-review-step"]', { timeout: 20_000 })
    await page.getByRole('button', { name: /confirm upload/i }).click()
    await expect(page.locator('[data-testid="upload-review-step"]')).not.toBeVisible({ timeout: 10_000 })

    await expect(page.getByTestId('document-card').first()).toBeVisible({ timeout: 10_000 })

    await page.goto('/content-search')

    const input = page.getByTestId('content-search-input')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('Physiotherapy')
    await input.press('Enter')

    const summaryBar = page.getByTestId('summary-bar')
    await expect(summaryBar).toBeVisible({ timeout: 10_000 })

    const text = await summaryBar.textContent()
    const match = text?.match(/(\d+)/)
    const count = match ? parseInt(match[1], 10) : 0
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
