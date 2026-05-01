import { test, expect } from '@playwright/test'

const BLOOD_TEST_PDF = 'src-tauri/tests/fixtures/BloodTest_2024-01-15.pdf'
const CLINIC_PDF = 'src-tauri/tests/fixtures/StMarysHospital_2024-06-15.pdf'

test.describe('Upload — filename-derived tag normalisation', () => {
  test('TC-FN-01 — BloodTest filename yields "Blood Work" chip, not "bloodtest"', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(BLOOD_TEST_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const tagChips = page.getByTestId('tag-chip')
    const allTags = await tagChips.allTextContents()
    const tagSet = allTags.map((t) => t.trim())

    expect(tagSet).toContain('Blood Work')
    expect(tagSet.map((t) => t.toLowerCase())).not.toContain('bloodtest')
  })

  test('TC-FN-02 — StMarysHospital filename yields "clinic:St Marys Hospital" chip', async ({
    page,
  }) => {
    await page.goto('/documents')
    await page.getByRole('button', { name: /upload/i }).click()
    await page.locator('input[type="file"]').setInputFiles(CLINIC_PDF)
    await page.waitForSelector('[data-testid="upload-review-step"]')

    const tagChips = page.getByTestId('tag-chip')
    const allTags = await tagChips.allTextContents()
    const tagSet = allTags.map((t) => t.trim())

    expect(tagSet).toContain('clinic:St Marys Hospital')
  })
})
