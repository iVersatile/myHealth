import { waitForApp } from '../helpers/app'
import { SEL } from '../helpers/selectors'

describe('Navigation + keyboard smoke (TC-WD-11 – TC-WD-15)', () => {
  before(async () => {
    await waitForApp()
  })

  it('TC-WD-11: all main nav items reachable by click', async () => {
    for (const sel of [SEL.navDocuments, SEL.navNotes, SEL.navClinics, SEL.navTrash]) {
      const item = await $(sel)
      await item.waitForDisplayed({ timeout: 5_000 })
      await item.click()
      expect(await item.isDisplayed()).toBe(true)
    }
  })

  it('TC-WD-12: Tab key cycles through nav items without trapping focus', async () => {
    const navDocs = await $(SEL.navDocuments)
    await navDocs.click()

    const focused: string[] = []
    for (let i = 0; i < 10; i++) {
      await browser.keys('Tab')
      const el = await browser.getActiveElement()
      const testId = await el.getAttribute('data-testid')
      if (testId) focused.push(testId)
    }

    const navTestIds = ['nav-documents', 'nav-notes', 'nav-clinics', 'nav-trash']
    expect(focused.some((id) => navTestIds.includes(id))).toBe(true)
  })

  it('TC-WD-13: Escape key closes upload dialog', async () => {
    const navDocs = await $(SEL.navDocuments)
    await navDocs.click()

    const uploadBtn = await $(SEL.uploadBtn)
    await uploadBtn.waitForClickable({ timeout: 5_000 })
    await uploadBtn.click()

    const dialog = await $(SEL.uploadDialog)
    await dialog.waitForDisplayed({ timeout: 5_000 })

    await browser.keys('Escape')

    await browser.waitUntil(
      async () => !(await dialog.isDisplayed().catch(() => false)),
      { timeout: 3_000, timeoutMsg: 'Upload dialog did not close after Escape' }
    )
  })

  it('TC-WD-14: Timeline tab renders on documents page', async () => {
    const navDocs = await $(SEL.navDocuments)
    await navDocs.click()

    const timelineTab = await $('[data-testid="timeline-tab-chronological"]')
    await timelineTab.waitForDisplayed({ timeout: 8_000 })
    expect(await timelineTab.isDisplayed()).toBe(true)
  })

  it('TC-WD-15: Trash page renders without crashing', async () => {
    const navTrash = await $(SEL.navTrash)
    await navTrash.click()

    await browser.waitUntil(
      async () => {
        const empty = await $('[data-testid="trash-empty"]')
        const items = await $$('[data-testid="trash-item"]')
        return (await empty.isExisting()) || items.length > 0
      },
      { timeout: 8_000, timeoutMsg: 'Trash page did not render' }
    )
  })
})
