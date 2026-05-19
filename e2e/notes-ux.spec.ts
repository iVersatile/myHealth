import { test, expect } from './fixtures'

const MEDICAL_INVOICE_PDF = 'src-tauri/tests/fixtures/medical-invoice.pdf'

test.describe('Notes UX — Phase 43', () => {
  test('TC-NOTES-01 — document detail shows "+ Add Note" link that navigates to linked note editor', async ({
    page,
  }) => {
    // Upload medical-invoice.pdf
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(MEDICAL_INVOICE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm upload/i }).click()

    // Open document detail
    await page.getByTestId('document-card').first().click()
    await page.waitForURL(/\/documents\//)

    // "+ Add Note" link visible and navigates correctly
    const addNoteLink = page.getByRole('link', { name: /add note/i }).first()
    await expect(addNoteLink).toBeVisible()
    await addNoteLink.click()

    // Should land on note editor with linkedDocumentId in URL
    await page.waitForURL(/\/notes\/view/)
    expect(page.url()).toContain('linkedDocumentId=')
  })

  test('TC-NOTES-02 — OCR toggle visible and switches on when linked doc has extracted_text', async ({
    page,
  }) => {
    // Upload medical-invoice.pdf (has extracted_text in mock)
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(MEDICAL_INVOICE_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')
    await page.getByRole('button', { name: /confirm upload/i }).click()

    // Open document detail and click "+ Add Note"
    await page.getByTestId('document-card').first().click()
    await page.waitForURL(/\/documents\//)
    await page.getByRole('link', { name: /add note/i }).first().click()
    await page.waitForURL(/\/notes\/view/)

    // OCR prefill toggle should be visible (linked doc has extracted_text)
    const toggle = page.getByRole('switch')
    await expect(toggle).toBeVisible()

    // Toggle initially off
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    // Click toggle — aria-checked flips to true
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  test('TC-NOTES-03 — empty notes list shows CTA that navigates to note creation', async ({ page }) => {
    await page.goto('/notes')

    // Empty state visible
    await expect(page.getByText(/no notes yet/i)).toBeVisible()
    const cta = page.getByRole('button', { name: /create your first note/i })
    await expect(cta).toBeVisible()

    // Click CTA → navigates into notes flow
    await cta.click()
    await page.waitForURL(/\/notes\//)
    expect(page.url()).toMatch(/\/notes\/(new|view)/)
  })
})
