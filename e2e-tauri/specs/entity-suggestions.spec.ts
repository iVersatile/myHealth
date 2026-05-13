import path from 'path'
import { waitForApp } from '../helpers/app'
import { SEL } from '../helpers/selectors'

const FIXTURE_INVOICE = path.resolve(
  __dirname,
  '../../src-tauri/tests/fixtures/medical-invoice.pdf'
)

async function openUploadAndDrop(fixturePath: string) {
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
    fixturePath
  )
}

describe('Entity suggestion smoke (TC-WD-06 – TC-WD-10)', () => {
  before(async () => {
    await waitForApp()
  })

  it('TC-WD-06: contact suggestion card visible in review step', async () => {
    await openUploadAndDrop(FIXTURE_INVOICE)

    await browser.waitUntil(
      async () => {
        const cards = await $$('[data-testid="contact-suggestion-card"]')
        return cards.length > 0
      },
      { timeout: 15_000, timeoutMsg: 'No contact suggestion card appeared' }
    )
  })

  it('TC-WD-07: accept contact suggestion → doctor suggestion banner visible', async () => {
    const acceptBtn = await $('[data-testid="contact-suggestion-accept"]')
    await acceptBtn.waitForClickable({ timeout: 5_000 })
    await acceptBtn.click()

    const saveBtn = await $(SEL.uploadSave)
    await saveBtn.waitForClickable({ timeout: 5_000 })
    await saveBtn.click()

    await browser.waitUntil(
      async () => {
        const banner = await $('[data-testid="doctor-suggestion-banner"]')
        return banner.isExisting()
      },
      { timeout: 10_000, timeoutMsg: 'Doctor suggestion banner not found after accept' }
    )
  })

  it('TC-WD-08: upload fixture → clinic suggestion card visible', async () => {
    const navDocs = await $(SEL.navDocuments)
    await navDocs.click()

    await openUploadAndDrop(FIXTURE_INVOICE)

    await browser.waitUntil(
      async () => {
        const cards = await $$('[data-testid="clinic-suggestion-card"]')
        return cards.length > 0
      },
      { timeout: 15_000, timeoutMsg: 'No clinic suggestion card appeared' }
    )
  })

  it('TC-WD-09: accept clinic → clinic row visible in clinics page', async () => {
    const acceptBtn = await $('[data-testid="clinic-suggestion-accept"]')
    if (await acceptBtn.isExisting()) {
      await acceptBtn.waitForClickable({ timeout: 5_000 })
      await acceptBtn.click()
    }

    const saveBtn = await $(SEL.uploadSave)
    await saveBtn.waitForClickable({ timeout: 5_000 })
    await saveBtn.click()

    const navClinics = await $(SEL.navClinics)
    await navClinics.click()

    const clinicList = await $(SEL.clinicList)
    await clinicList.waitForDisplayed({ timeout: 8_000 })

    const items = await $$('[data-testid="clinic-item"]')
    expect(items.length).toBeGreaterThan(0)
  })

  it('TC-WD-10: upload fixture → appointment suggestion banner appears', async () => {
    const navDocs = await $(SEL.navDocuments)
    await navDocs.click()

    await openUploadAndDrop(FIXTURE_INVOICE)

    const saveBtn = await $(SEL.uploadSave)
    await saveBtn.waitForClickable({ timeout: 5_000 })
    await saveBtn.click()

    await browser.waitUntil(
      async () => {
        const banner = await $('[data-testid="appt-suggestion-banner"]')
        return banner.isExisting()
      },
      { timeout: 12_000, timeoutMsg: 'Appointment suggestion banner did not appear' }
    )
  })
})
