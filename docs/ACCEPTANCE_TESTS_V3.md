# Acceptance Tests V3 — Document Upload Intelligence Phase 2

> **Linked PRD**: `docs/PRD_V3.md`
> **Test framework**: Playwright (TypeScript)
> **Fixtures directory**: `src-tauri/tests/fixtures/`

---

## Test Fixtures Required

| Fixture file | Status | Description |
|---|---|---|
| `src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf` | **Real** | Actual upload sample: JOHN GREEN PHYSIOTHERAPY LTD invoice, date 09 Mar 2023, Company Reg 6780032, 3 addresses, phone 07544 370440, email jg@johngreenphysio.com — use for all positive test cases |
| `src-tauri/tests/fixtures/no-date-physio.pdf` | Synthetic needed | Same provider content but no date in PDF body; filename carries date `(09Mar2023-16_31_26)` |
| `src-tauri/tests/fixtures/no-date-no-filename.pdf` | Synthetic needed | PHYSIOTHERAPY invoice with no date in body and no date in filename |

---

## Suite 1 — Category Auto-Creation (V3-F1)

### TC-V3-F1-01 — Category suggestion banner appears for unknown specialty

```typescript
import { test, expect } from '@playwright/test'

test('category suggestion banner shown for unknown specialty keyword', async ({ page }) => {
  // Arrange
  await page.goto('/documents')

  // Act
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  // Assert
  const banner = page.getByTestId('category-suggestion-banner')
  await expect(banner).toBeVisible()
  await expect(banner).toContainText('Physiotherapy')
})
```

### TC-V3-F1-02 — Accepting suggestion creates category and assigns document

```typescript
test('accepting category suggestion creates the category and assigns it', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  await page.getByTestId('category-suggestion-accept').click()
  await page.getByRole('button', { name: /save|confirm/i }).click()

  // Verify in document list
  await page.goto('/documents')
  const doc = page.getByTestId('document-card').first()
  await expect(doc).toContainText('Physiotherapy')

  // Verify in Categories settings
  await page.goto('/settings/categories')
  await expect(page.getByText('Physiotherapy')).toBeVisible()
})
```

### TC-V3-F1-03 — Dismissing suggestion leaves category unassigned

```typescript
test('dismissing category suggestion leaves document without that category', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  await page.getByTestId('category-suggestion-dismiss').click()
  await page.getByRole('button', { name: /save|confirm/i }).click()

  await page.goto('/settings/categories')
  // "Physiotherapy" should NOT have been auto-created
  await expect(page.getByText('Physiotherapy')).not.toBeVisible()
})
```

### TC-V3-F1-04 — No banner shown when specialty already exists as a category

```typescript
test('no category suggestion banner when category already exists', async ({ page }) => {
  // Pre-create "Physiotherapy" category
  await page.goto('/settings/categories')
  await page.getByRole('button', { name: /add category/i }).click()
  await page.getByLabel(/name/i).fill('Physiotherapy')
  await page.getByRole('button', { name: /save/i }).click()

  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  await expect(page.getByTestId('category-suggestion-banner')).not.toBeVisible()
})
```

---

## Suite 2 — Contact Extraction with UK Mobile Phone (V3-F2)

### TC-V3-F2-01 — Contact suggestion card shown with extracted name, phone, email

```typescript
test('contact suggestion card shows name, UK mobile phone, and email', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  const card = page.getByTestId('contact-suggestion-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText('John Green')
  await expect(card).toContainText('07544 370440')
  await expect(card).toContainText('jg@johngreenphysio.com')
})
```

### TC-V3-F2-02 — Saving contact suggestion creates contact record

```typescript
test('saving contact suggestion creates a new contact', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  await page.getByTestId('contact-suggestion-save').click()
  await page.getByRole('button', { name: /save|confirm/i }).click()

  await page.goto('/contacts')
  const contact = page.getByText('John Green')
  await expect(contact).toBeVisible()
  await contact.click()
  await expect(page.getByText('07544 370440')).toBeVisible()
  await expect(page.getByText('jg@johngreenphysio.com')).toBeVisible()
})
```

### TC-V3-F2-03 — UK mobile format `07XXX XXXXXX` is matched

```typescript
test('UK mobile number in 07XXX XXXXXX format is extracted', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  const phoneField = page.getByTestId('contact-suggestion-phone')
  await expect(phoneField).toHaveValue('07544 370440')
})
```

### TC-V3-F2-04 — Duplicate contact is not created when one already exists

```typescript
test('no duplicate contact created if contact already exists', async ({ page }) => {
  // Pre-create contact
  await page.goto('/contacts')
  await page.getByRole('button', { name: /add contact/i }).click()
  await page.getByLabel(/name/i).fill('John Green')
  await page.getByRole('button', { name: /save/i }).click()

  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  // Should show merge/update option, not a create-new card
  const mergeOption = page.getByTestId('contact-suggestion-merge')
  await expect(mergeOption).toBeVisible()
})
```

### TC-V3-F2-05 — Contact suggestion can be dismissed

```typescript
test('dismissing contact suggestion does not create contact', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  await page.getByTestId('contact-suggestion-dismiss').click()
  await page.getByRole('button', { name: /save|confirm/i }).click()

  await page.goto('/contacts')
  await expect(page.getByText('John Green')).not.toBeVisible()
})
```

---

## Suite 3 — Clinic Extraction with Company Registration Number (V3-F3)

### TC-V3-F3-01 — Clinic suggestion card appears with name, company reg, addresses

```typescript
test('clinic suggestion card shows name, company registration number, and all addresses', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  const card = page.getByTestId('clinic-suggestion-card')
  await expect(card).toBeVisible()
  await expect(card).toContainText('JOHN GREEN PHYSIOTHERAPY LTD')
  await expect(card).toContainText('6780032')
  // Three addresses should be listed
  const addresses = card.getByTestId('clinic-address-item')
  await expect(addresses).toHaveCount(3)
})
```

### TC-V3-F3-02 — Saving clinic suggestion creates clinic with all addresses

```typescript
test('saving clinic creates record with company reg and three addresses', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  await page.getByTestId('clinic-suggestion-save').click()
  await page.getByRole('button', { name: /save|confirm/i }).click()

  await page.goto('/contacts') // clinics shown in contacts or dedicated view
  await page.getByText('JOHN GREEN PHYSIOTHERAPY LTD').click()
  await expect(page.getByText('6780032')).toBeVisible()
  const addresses = page.getByTestId('clinic-address-item')
  await expect(addresses).toHaveCount(3)
})
```

### TC-V3-F3-03 — Clinic and contact are linked after both are saved

```typescript
test('saved clinic and saved contact are linked together', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  await page.getByTestId('contact-suggestion-save').click()
  await page.getByTestId('clinic-suggestion-save').click()
  await page.getByRole('button', { name: /save|confirm/i }).click()

  // Verify link: contact detail shows clinic association
  await page.goto('/contacts')
  await page.getByText('John Green').click()
  await expect(page.getByText('JOHN GREEN PHYSIOTHERAPY LTD')).toBeVisible()
})
```

### TC-V3-F3-04 — Company Registration Number pattern extracted correctly

```typescript
test('company registration number is extracted from "Company Registration No: XXXXXXXX" pattern', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  const regField = page.getByTestId('clinic-suggestion-reg-number')
  await expect(regField).toHaveValue('6780032')
})
```

### TC-V3-F3-05 — No duplicate clinic created when clinic already exists

```typescript
test('no duplicate clinic created if clinic already exists', async ({ page }) => {
  await page.goto('/contacts')
  await page.getByRole('button', { name: /add clinic/i }).click()
  await page.getByLabel(/name/i).fill('JOHN GREEN PHYSIOTHERAPY LTD')
  await page.getByRole('button', { name: /save/i }).click()

  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  const mergeOption = page.getByTestId('clinic-suggestion-merge')
  await expect(mergeOption).toBeVisible()
})
```

### TC-V3-F3-06 — Clinic suggestion can be dismissed

```typescript
test('dismissing clinic suggestion does not create clinic', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  await page.getByTestId('clinic-suggestion-dismiss').click()
  await page.getByRole('button', { name: /save|confirm/i }).click()

  await page.goto('/contacts')
  await expect(page.getByText('JOHN GREEN PHYSIOTHERAPY LTD')).not.toBeVisible()
})
```

---

## Suite 4 — Tag Auto-Extraction (V3-F4)

### TC-V3-F4-01 — All four tag types pre-populated on upload review

```typescript
test('all four tags pre-populated: document type, provider, specialty, activity date', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  const tagChips = page.getByTestId('tag-chip')
  const allTags = await tagChips.allTextContents()
  const tagSet = allTags.map(t => t.trim().toLowerCase())

  expect(tagSet).toContain('invoice')
  expect(tagSet).toContain('john green')
  expect(tagSet).toContain('physiotherapy')
  expect(tagSet).toContain('2023-03-09')
})
```

### TC-V3-F4-02 — Tags are persisted after document is saved

```typescript
test('auto-extracted tags are persisted with saved document', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')
  await page.getByRole('button', { name: /save|confirm/i }).click()

  await page.goto('/documents')
  const doc = page.getByTestId('document-card').first()
  await doc.click()

  const tagChips = page.getByTestId('tag-chip')
  const allTags = await tagChips.allTextContents()
  const tagSet = allTags.map(t => t.trim().toLowerCase())

  expect(tagSet).toContain('invoice')
  expect(tagSet).toContain('john green')
  expect(tagSet).toContain('physiotherapy')
  expect(tagSet).toContain('2023-03-09')
})
```

### TC-V3-F4-03 — User can add or remove tags before saving

```typescript
test('user can remove an auto-extracted tag and add a custom tag before saving', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  // Remove the 'invoice' tag
  await page.getByTestId('tag-chip').filter({ hasText: 'invoice' })
    .getByRole('button', { name: /remove/i }).click()

  // Add a custom tag
  await page.getByTestId('tag-input').fill('custom-tag')
  await page.keyboard.press('Enter')

  await page.getByRole('button', { name: /save|confirm/i }).click()

  await page.goto('/documents')
  await page.getByTestId('document-card').first().click()

  const tagChips = page.getByTestId('tag-chip')
  const allTags = await tagChips.allTextContents()
  const tagSet = allTags.map(t => t.trim().toLowerCase())

  expect(tagSet).not.toContain('invoice')
  expect(tagSet).toContain('custom-tag')
})
```

---

## Suite 5 — Timeline Activity Date (V3-F5)

### TC-V3-F5-01 — Timeline entry uses service date from PDF body (highest priority)

```typescript
test('timeline entry date is the service date extracted from PDF body', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  const dateField = page.getByTestId('activity-date-field')
  await expect(dateField).toHaveValue('2023-03-09')
})
```

### TC-V3-F5-02 — Timeline entry falls back to filename date when PDF body has no date

```typescript
test('timeline entry falls back to filename date when PDF body has no service date', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('tests/fixtures/no-date-physio.pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  const dateField = page.getByTestId('activity-date-field')
  await expect(dateField).toHaveValue('2023-03-09')
})
```

### TC-V3-F5-03 — Timeline entry falls back to upload date when no date available

```typescript
test('timeline entry falls back to upload date when neither PDF body nor filename has a date', async ({ page }) => {
  const beforeUpload = new Date()
  const dateStr = beforeUpload.toISOString().split('T')[0]

  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('tests/fixtures/no-date-no-filename.pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  const dateField = page.getByTestId('activity-date-field')
  await expect(dateField).toHaveValue(dateStr)
})
```

### TC-V3-F5-04 — Timeline entry description format is correct

```typescript
test('timeline entry description format is "{date} {SPECIALTY} with {Title} {Provider}"', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')
  await page.getByTestId('contact-suggestion-save').click()
  await page.getByRole('button', { name: /save|confirm/i }).click()

  await page.goto('/timeline')
  const entry = page.getByTestId('timeline-entry').first()
  await expect(entry).toContainText('2023-03-09 PHYSIOTHERAPY with Mr John Green')
})
```

### TC-V3-F5-05 — User can edit activity date before saving

```typescript
test('user can override the extracted activity date before saving', async ({ page }) => {
  await page.goto('/documents')
  await page.getByRole('button', { name: /upload/i }).click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf')
  await page.waitForSelector('[data-testid="upload-review-step"]')

  const dateField = page.getByTestId('activity-date-field')
  await dateField.fill('2023-03-15')
  await page.getByRole('button', { name: /save|confirm/i }).click()

  await page.goto('/timeline')
  const entry = page.getByTestId('timeline-entry').first()
  await expect(entry).toContainText('2023-03-15')
})
```

---

## Test Data Requirements Summary

| Fixture | Status | Key content |
|---|---|---|
| `src-tauri/tests/fixtures/sample-Upload (09Mar2023-16_31_26).pdf` | **Real** | Provider: JOHN GREEN PHYSIOTHERAPY LTD; Contact: Mr John Green; Phone: 07544 370440; Email: jg@johngreenphysio.com; Company Reg: 6780032; 3 addresses; Document type: INVOICE; Service date: 09 Mar 2023 |
| `src-tauri/tests/fixtures/no-date-physio.pdf` | Synthetic needed | Same provider content but no date in PDF body; filename: `Upload (09Mar2023-16_31_26).pdf` |
| `src-tauri/tests/fixtures/no-date-no-filename.pdf` | Synthetic needed | PHYSIOTHERAPY invoice; no date in body; filename has no date token |

---

## PRD V3 Coverage Mapping

| PRD Requirement ID | Requirement summary | Test case(s) |
|---|---|---|
| V3-F1.1 | Create category on Accept | TC-V3-F1-02 |
| V3-F1.2 | Show suggestion banner for unknown specialty | TC-V3-F1-01 |
| V3-F1.3 | Title-case category name | TC-V3-F1-01, TC-V3-F1-02 |
| V3-F1.4 | Dismiss does not create category | TC-V3-F1-03 |
| V3-F1.5 | No banner when category exists | TC-V3-F1-04 |
| V3-F2.1 | Match `07XXX XXXXXX` UK mobile | TC-V3-F2-03 |
| V3-F2.2 | Show contact suggestion card | TC-V3-F2-01 |
| V3-F2.3 | Save creates contact record | TC-V3-F2-02 |
| V3-F2.4 | Dismiss does not create contact | TC-V3-F2-05 |
| V3-F2.5 | No duplicate if contact exists | TC-V3-F2-04 |
| V3-F3.1 | Show clinic suggestion card | TC-V3-F3-01 |
| V3-F3.2 | Extract Company Registration Number | TC-V3-F3-04 |
| V3-F3.3 | Extract multiple addresses | TC-V3-F3-01, TC-V3-F3-02 |
| V3-F3.4 | Save creates clinic with all data | TC-V3-F3-02 |
| V3-F3.5 | Link clinic to contact on save | TC-V3-F3-03 |
| V3-F3.6 | No duplicate if clinic exists | TC-V3-F3-05 |
| V3-F3.7 | Dismiss does not create clinic | TC-V3-F3-06 |
| V3-F4.1 | Extract document-type tag (invoice/receipt/bill) | TC-V3-F4-01 |
| V3-F4.2 | Extract provider name tag | TC-V3-F4-01 |
| V3-F4.3 | Extract specialty keyword tag | TC-V3-F4-01 |
| V3-F4.4 | Extract activity date as tag (YYYY-MM-DD) | TC-V3-F4-01 |
| V3-F4.5 | Tags persisted after save | TC-V3-F4-02 |
| V3-F4.6 | User can edit tags before save | TC-V3-F4-03 |
| V3-F5.1 | Use service date from PDF body (priority 1) | TC-V3-F5-01 |
| V3-F5.2 | Fall back to filename date (priority 2) | TC-V3-F5-02 |
| V3-F5.3 | Fall back to upload date (priority 3) | TC-V3-F5-03 |
| V3-F5.4 | Description format `{date} {SPECIALTY} with {Title} {Name}` | TC-V3-F5-04 |
| V3-F5.5 | User can override activity date before save | TC-V3-F5-05 |
