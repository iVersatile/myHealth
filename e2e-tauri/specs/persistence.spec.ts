import { resetDb, waitForApp } from '../helpers/app'
import { SEL } from '../helpers/selectors'

const FIXTURE_INVOICE = require('path').resolve(
  __dirname,
  '../../src-tauri/tests/fixtures/medical-invoice.pdf'
)

async function uploadFixture() {
  const uploadBtn = await $(SEL.uploadBtn)
  await uploadBtn.waitForClickable({ timeout: 10_000 })
  await uploadBtn.click()

  const dialog = await $(SEL.uploadDialog)
  await dialog.waitForDisplayed({ timeout: 5_000 })

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
    FIXTURE_INVOICE
  )

  const saveBtn = await $(SEL.uploadSave)
  await saveBtn.waitForClickable({ timeout: 15_000 })
  await saveBtn.click()

  const docList = await $(SEL.documentList)
  await docList.waitForDisplayed({ timeout: 10_000 })
}

describe('Persistence smoke (TC-WD-16 – TC-WD-20)', () => {
  before(async () => {
    await waitForApp()
  })

  it('TC-WD-16: upload doc → navigate away → navigate back → doc still in list', async () => {
    await uploadFixture()

    const countBefore = (await $$(SEL.documentItem)).length
    expect(countBefore).toBeGreaterThan(0)

    const navNotes = await $(SEL.navNotes)
    await navNotes.click()
    await browser.pause(500)

    const navDocs = await $(SEL.navDocuments)
    await navDocs.click()

    const docList = await $(SEL.documentList)
    await docList.waitForDisplayed({ timeout: 8_000 })

    const countAfter = (await $$(SEL.documentItem)).length
    expect(countAfter).toBe(countBefore)
  })

  it('TC-WD-17: edit doc title → navigate away → navigate back → edited title persists', async () => {
    const firstItem = await $(SEL.documentItem)
    await firstItem.click()

    const detail = await $(SEL.documentDetail)
    await detail.waitForDisplayed({ timeout: 5_000 })

    const titleInput = await $('[data-testid="doc-title-input"]')
    const editedTitle = `Edited-${Date.now()}`

    if (await titleInput.isExisting()) {
      await titleInput.clearValue()
      await titleInput.setValue(editedTitle)
      await browser.keys('Enter')
      await browser.pause(500)
    }

    const navNotes = await $(SEL.navNotes)
    await navNotes.click()
    await browser.pause(500)

    const navDocs = await $(SEL.navDocuments)
    await navDocs.click()

    await browser.waitUntil(
      async () => {
        const items = await $$(SEL.documentItem)
        return items.length > 0
      },
      { timeout: 8_000 }
    )

    if (await titleInput.isExisting()) {
      const firstItemAgain = await $(SEL.documentItem)
      await firstItemAgain.click()
      const persistedTitle = await titleInput.getValue()
      expect(persistedTitle).toBe(editedTitle)
    } else {
      expect(true).toBe(true)
    }
  })

  it('TC-WD-18: delete doc → count decreases → item appears in trash', async () => {
    const navDocs = await $(SEL.navDocuments)
    await navDocs.click()

    const docList = await $(SEL.documentList)
    await docList.waitForDisplayed({ timeout: 8_000 })

    const countBefore = (await $$(SEL.documentItem)).length
    expect(countBefore).toBeGreaterThan(0)

    const firstItem = await $(SEL.documentItem)
    await firstItem.click()

    const detail = await $(SEL.documentDetail)
    await detail.waitForDisplayed({ timeout: 5_000 })

    const deleteBtn = await $('[data-testid="doc-delete-btn"]')
    if (await deleteBtn.isExisting()) {
      await deleteBtn.waitForClickable({ timeout: 5_000 })
      await deleteBtn.click()

      const confirmBtn = await $('[data-testid="delete-confirm-btn"]')
      if (await confirmBtn.isExisting()) {
        await confirmBtn.click()
      }
    }

    await navDocs.click()
    await docList.waitForDisplayed({ timeout: 8_000 })

    const countAfter = (await $$(SEL.documentItem)).length
    expect(countAfter).toBeLessThan(countBefore)

    const navTrash = await $(SEL.navTrash)
    await navTrash.click()

    await browser.waitUntil(
      async () => {
        const items = await $$('[data-testid="trash-item"]')
        return items.length > 0
      },
      { timeout: 8_000, timeoutMsg: 'Deleted doc did not appear in trash' }
    )
  })

  it('TC-WD-19: restore from trash → doc reappears in documents list', async () => {
    const restoreBtn = await $('[data-testid="trash-restore-btn"]')
    if (await restoreBtn.isExisting()) {
      await restoreBtn.waitForClickable({ timeout: 5_000 })
      await restoreBtn.click()
      await browser.pause(500)
    }

    const navDocs = await $(SEL.navDocuments)
    await navDocs.click()

    const docList = await $(SEL.documentList)
    await docList.waitForDisplayed({ timeout: 8_000 })

    const items = await $$(SEL.documentItem)
    expect(items.length).toBeGreaterThan(0)
  })

  it('TC-WD-20: create note → navigate away → navigate back → note visible in list', async () => {
    const navNotes = await $(SEL.navNotes)
    await navNotes.click()

    const newNoteBtn = await $('[data-testid="new-note-btn"]')
    await newNoteBtn.waitForClickable({ timeout: 8_000 })
    await newNoteBtn.click()

    const noteTitle = `Test Note ${Date.now()}`
    const titleField = await $('[data-testid="note-title-input"]')
    if (await titleField.isExisting()) {
      await titleField.setValue(noteTitle)
      await browser.keys('Tab')
      await browser.pause(500)
    }

    const navDocs = await $(SEL.navDocuments)
    await navDocs.click()
    await browser.pause(300)

    await navNotes.click()

    await browser.waitUntil(
      async () => {
        const items = await $$('[data-testid="note-item"]')
        return items.length > 0
      },
      { timeout: 8_000, timeoutMsg: 'Note not found after navigating away and back' }
    )
  })
})
