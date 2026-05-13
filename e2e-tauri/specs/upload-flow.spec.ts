import { waitForApp } from '../helpers/app'
import { SEL } from '../helpers/selectors'

describe('Upload flow (TC-WD-01 – TC-WD-05)', () => {
  before(async () => {
    await waitForApp()
  })

  it('TC-WD-01: documents page loads, upload button visible', async () => {
    const uploadBtn = await $(SEL.uploadBtn)
    await uploadBtn.waitForDisplayed({ timeout: 10_000 })
    expect(await uploadBtn.isDisplayed()).toBe(true)
  })

  it('TC-WD-02: upload single PDF → review step shows tag chip', async () => {
    const uploadBtn = await $(SEL.uploadBtn)
    await uploadBtn.click()

    const dialog = await $(SEL.uploadDialog)
    await dialog.waitForDisplayed({ timeout: 5_000 })

    const fixturePath = require('path').resolve(
      __dirname,
      '../../src-tauri/tests/fixtures/medical-invoice.pdf'
    )
    await browser.execute(
      (sel: string, fp: string) => {
        const dt = new DataTransfer()
        const file = new File([''], fp.split('/').pop() ?? 'file.pdf', {
          type: 'application/pdf',
        })
        dt.items.add(file)
        const el = document.querySelector(sel)
        if (el) {
          el.dispatchEvent(
            new DragEvent('drop', { dataTransfer: dt, bubbles: true })
          )
        }
      },
      SEL.uploadFileDrop,
      fixturePath
    )

    await browser.waitUntil(
      async () => {
        const chips = await $$('[data-testid="tag-chip"]')
        return chips.length > 0
      },
      { timeout: 15_000, timeoutMsg: 'No tag chips appeared after upload' }
    )
  })

  it('TC-WD-03: confirm upload → document row appears in list', async () => {
    const saveBtn = await $(SEL.uploadSave)
    await saveBtn.waitForClickable({ timeout: 5_000 })
    await saveBtn.click()

    const docList = await $(SEL.documentList)
    await docList.waitForDisplayed({ timeout: 10_000 })

    const items = await $$(SEL.documentItem)
    expect(items.length).toBeGreaterThan(0)
  })

  it('TC-WD-04: document row click → detail page loads', async () => {
    const firstItem = await $(SEL.documentItem)
    await firstItem.click()

    const detail = await $(SEL.documentDetail)
    await detail.waitForDisplayed({ timeout: 5_000 })
    expect(await detail.isDisplayed()).toBe(true)
  })

  it('TC-WD-05: search for "medical" → at least one result returned', async () => {
    const navDocs = await $(SEL.navDocuments)
    await navDocs.click()

    const searchInput = await $(SEL.searchInput)
    await searchInput.waitForDisplayed({ timeout: 5_000 })
    await searchInput.setValue('medical')

    await browser.waitUntil(
      async () => {
        const items = await $$(SEL.documentItem)
        return items.length > 0
      },
      { timeout: 8_000, timeoutMsg: 'Search returned no results for "medical"' }
    )
  })
})
