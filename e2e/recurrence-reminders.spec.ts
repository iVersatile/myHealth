import { test, expect } from './fixtures'

async function createAppointment(
  page: import('@playwright/test').Page,
  opts: {
    title: string
    date: string
    repeat?: 'weekly' | 'monthly'
    occurrences?: number
    remMin15?: boolean
    remHr1?: boolean
    remDay1?: boolean
  }
) {
  await page.getByRole('button', { name: /\+ new/i }).click()
  await page.locator('#appt-title').fill(opts.title)
  await page.locator('#appt-date').fill(opts.date)
  if (opts.repeat) {
    await page.locator('#appt-repeat').selectOption(opts.repeat)
    if (opts.occurrences !== undefined) {
      await page.locator('#appt-repeat-occurrences').fill(String(opts.occurrences))
    }
  }
  if (opts.remMin15) await page.locator('#rem-min15').check()
  if (opts.remHr1) await page.locator('#rem-hr1').check()
  if (opts.remDay1) await page.locator('#rem-day1').check()
  await page.getByRole('button', { name: /save appointment/i }).click()
  await expect(page.locator('#appt-title')).not.toBeVisible()
}

// TC-REC-01: weekly recurring appt → 5 cards each with recurrence badge
test('TC-REC-01 weekly series shows 5 cards with recurring badge', async ({ page }) => {
  await page.goto('/appointments')
  await createAppointment(page, {
    title: 'Weekly Physio',
    date: '2027-06-02T10:00',
    repeat: 'weekly',
    occurrences: 5,
  })
  await expect(page.locator('[data-testid="appointment-card"]')).toHaveCount(5)
  await expect(page.locator('[data-testid="recurrence-badge"]')).toHaveCount(5)
})

// TC-REC-02: delete single occurrence → count drops by 1
test('TC-REC-02 delete single occurrence reduces count by 1', async ({ page }) => {
  await page.goto('/appointments')
  await createAppointment(page, {
    title: 'Cardio Check',
    date: '2027-07-01T10:00',
    repeat: 'weekly',
    occurrences: 3,
  })
  await expect(page.locator('[data-testid="appointment-card"]')).toHaveCount(3)

  await page.locator('[data-testid="appointment-card"]').first().getByRole('button', { name: /delete/i }).click()
  await page.getByRole('button', { name: /delete this occurrence only/i }).click()

  await expect(page.locator('[data-testid="appointment-card"]')).toHaveCount(2)
})

// TC-REC-03: delete entire series → all appointments removed
test('TC-REC-03 delete entire series removes all occurrences', async ({ page }) => {
  await page.goto('/appointments')
  await createAppointment(page, {
    title: 'Monthly Review',
    date: '2027-08-01T10:00',
    repeat: 'weekly',
    occurrences: 4,
  })
  await expect(page.locator('[data-testid="appointment-card"]')).toHaveCount(4)

  await page.locator('[data-testid="appointment-card"]').first().getByRole('button', { name: /delete/i }).click()
  await page.getByRole('button', { name: /delete all in series/i }).click()

  await expect(page.locator('[data-testid="appointment-card"]')).toHaveCount(0)
})

// TC-REC-04: appointment with two reminder offsets shows 2 chips on detail view
test('TC-REC-04 detail view shows reminder chips for enabled offsets', async ({ page }) => {
  await page.goto('/appointments')
  await createAppointment(page, {
    title: 'Dental Check',
    date: '2027-09-15T09:00',
    remMin15: true,
    remHr1: true,
  })
  await page.locator('[data-testid="appointment-card"]').first().getByRole('link', { name: /open/i }).click()

  const chips = page.locator('[data-testid="reminder-chip"]')
  await expect(chips).toHaveCount(2)
  await expect(chips.nth(0)).toContainText('15 min before')
  await expect(chips.nth(1)).toContainText('1 hour before')
})

// TC-REC-05: reminders tile shows correct count
test('TC-REC-05 reminders tile shows count of appointments with reminders', async ({ page }) => {
  await page.goto('/appointments')
  await createAppointment(page, { title: 'Appt With Reminders 1', date: '2027-10-01T08:00', remMin15: true })
  await createAppointment(page, { title: 'Appt With Reminders 2', date: '2027-10-08T08:00', remHr1: true })
  await createAppointment(page, { title: 'Appt No Reminders', date: '2027-10-15T08:00' })

  const tile = page.locator('[data-testid="reminders-tile"]')
  await expect(tile).toBeVisible()
  await expect(tile).toContainText('2 appointments with reminders')
})
