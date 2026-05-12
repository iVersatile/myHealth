import path from 'path'
import { test, expect } from './fixtures'

const AXE_PATH = path.resolve('node_modules/axe-core/axe.min.js')

async function runAxe(page: import('@playwright/test').Page) {
  await page.addScriptTag({ path: AXE_PATH })
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axe = (window as any).axe
    return axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    })
  })
  return results as { violations: Array<{ id: string; description: string; nodes: unknown[] }> }
}

const SEED = [
  {
    id: 'doc-1',
    filename: 'Blood Test.pdf',
    file_path: '/tmp/blood.pdf',
    mime_type: 'application/pdf',
    category: 'lab',
    tags: [],
    activity_date: '2023-01-15',
    created_at: new Date().toISOString(),
    _deleted: false,
    extracted_text: null,
    _entities: [],
  },
]

function seedInvoke(page: import('@playwright/test').Page) {
  return page.addInitScript((docs) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, react/display-name
    ;(window as any).__TAURI_INVOKE_MOCK__ = async (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'documents_list') return docs
      if (cmd === 'documents_search_filtered') return { items: docs, total: docs.length }
      if (cmd === 'categories_list') return [{ id: 'lab', name: 'Lab' }]
      if (cmd === 'get_linked_documents') return []
      if (cmd === 'get_flagged_lab_values') return []
      if (cmd === 'contacts_list') return []
      if (cmd === 'clinics_list') return []
      if (cmd === 'tags_list') return []
      if (cmd === 'get_document_entities') return []
      if (cmd === 'document_get')
        return docs.find((d: { id: unknown }) => d.id === (args as { id: unknown })?.id) ?? null
      return null
    }
  }, SEED)
}

test.describe('Redesign-A axe accessibility audit', () => {
  test.beforeEach(async ({ page }) => {
    await seedInvoke(page)
  })

  test('no WCAG violations at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/documents')
    await page.waitForSelector('[data-testid="vault-layout"]', { timeout: 10_000 })

    const { violations } = await runAxe(page)

    if (violations.length > 0) {
      const summary = violations
        .map((v) => `[${v.id}] ${v.description} (${(v.nodes as unknown[]).length} node(s))`)
        .join('\n')
      console.log('axe violations at 1440px:\n' + summary)
    }
    expect(violations).toHaveLength(0)
  })

  test('no WCAG violations at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/documents')
    await page.waitForSelector('[data-testid="vault-layout"]', { timeout: 10_000 })

    const { violations } = await runAxe(page)

    if (violations.length > 0) {
      const summary = violations
        .map((v) => `[${v.id}] ${v.description} (${(v.nodes as unknown[]).length} node(s))`)
        .join('\n')
      console.log('axe violations at 1280px:\n' + summary)
    }
    expect(violations).toHaveLength(0)
  })
})
