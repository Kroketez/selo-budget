import { test, expect, type Page } from '@playwright/test'

// Freeze the clock so the sample data (built relative to "today") is always the same.
const TODAY = new Date('2026-10-23T12:00:00+01:00')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY)
  await page.goto('/')
  await expect(page.locator('.sheet')).toBeVisible()
})

const headline = (page: Page) => page.locator('#headline .figure')
const stamp = (page: Page, name: string) => page.locator('.stamp', { hasText: name })
const row = (page: Page, text: string) => page.locator('.tx', { hasText: text })

async function openComposer(page: Page) {
  await page.getByRole('button', { name: 'Add transaction' }).click()
  await expect(page.locator('#tx-amount')).toBeFocused()
}

async function addExpense(page: Page, amount: string, description: string, category: string) {
  await openComposer(page)
  await page.fill('#tx-amount', amount)
  await page.fill('#tx-desc', description)
  await page.selectOption('#tx-cat', category)
  await page.getByRole('button', { name: 'Add expense' }).click()
}

test('shows the month overview with sample data', async ({ page }) => {
  await expect(page.locator('#headline')).toContainText('left to spend in October')
  await expect(headline(page)).toHaveText('€688.78')
  await expect(page.locator('.stamp')).toHaveCount(8)
  await expect(stamp(page, 'Eating out')).toHaveClass(/is-over/)
  await expect(page.locator('.pace')).toContainText('a day for the next 9 days')
})

test('validates the form before adding', async ({ page }) => {
  await openComposer(page)
  await page.getByRole('button', { name: 'Add expense' }).click()
  await expect(page.locator('#err-amount')).toBeVisible()
  await expect(page.locator('#err-desc')).toBeVisible()
  await expect(page.locator('#tx-amount')).toBeFocused()
})

test('adding an expense lowers the stamp and cancels it when over', async ({ page }) => {
  await expect(stamp(page, 'Groceries')).not.toHaveClass(/is-over/)
  await addExpense(page, '150', 'Big Continente shop', 'groceries')

  await expect(page.locator('.composer')).toBeHidden()
  await expect(row(page, 'Big Continente shop')).toBeVisible()
  await expect(headline(page)).toHaveText('€538.78')
  await expect(stamp(page, 'Groceries')).toHaveClass(/is-over/)
  await expect(page.locator('.toast')).toContainText('Added')
})

test('edits a transaction', async ({ page }) => {
  await addExpense(page, '150', 'Big Continente shop', 'groceries')
  await row(page, 'Big Continente shop').click()
  await expect(page.locator('#composer-title')).toHaveText('Edit expense')
  await page.fill('#tx-amount', '20')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(stamp(page, 'Groceries')).not.toHaveClass(/is-over/)
  await expect(row(page, 'Big Continente shop')).toContainText('−€20.00')
})

test('deletes a transaction and undo brings it back', async ({ page }) => {
  await row(page, 'Pingo Doce').first().click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.locator('.tx')).toHaveCount(26)

  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('.tx')).toHaveCount(27)
})

test('filters by stamp, type and search', async ({ page }) => {
  await stamp(page, 'Eating out').getByRole('button').click()
  await expect(page.locator('.tx')).toHaveCount(7)
  for (const cat of await page.locator('.tx-cat').allTextContents()) expect(cat).toBe('Eating out')

  await page.getByRole('button', { name: 'Remove Eating out filter' }).click()
  await page.getByRole('button', { name: 'Income', exact: true }).click()
  for (const amt of await page.locator('.tx-amt').allTextContents()) expect(amt.startsWith('+')).toBe(true)

  await page.getByRole('button', { name: 'All', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search transactions' }).fill('zzzz')
  await expect(page.getByText('No transactions match')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.locator('.tx')).toHaveCount(27)
})

test('edits a budget', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit budgets' }).click()
  await page.getByLabel('Eating out monthly budget in euros').fill('400')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(stamp(page, 'Eating out')).not.toHaveClass(/is-over/)
  await expect(stamp(page, 'Eating out')).toContainText('left of €400')
})

test('saves to the browser and restores sample data on reset', async ({ page }) => {
  await addExpense(page, '12.50', 'Saved coffee', 'eating')
  await page.reload()
  await expect(row(page, 'Saved coffee')).toBeVisible()

  await page.getByRole('button', { name: 'Reset sample data' }).click()
  await expect(row(page, 'Saved coffee')).toHaveCount(0)
  await expect(headline(page)).toHaveText('€688.78')
})

test('moves between months', async ({ page, isMobile }) => {
  if (isMobile) {
    await page.getByRole('button', { name: 'Next month' }).click()
  } else {
    await page.getByRole('navigation', { name: 'Months' }).getByRole('button', { name: /November/ }).click()
  }
  await expect(page.getByText('Nothing posted in November yet.')).toBeVisible()
  await expect(page.locator('.pace')).toContainText('hasn’t started yet')
})

test('N opens the form on desktop', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keyboard shortcut is for desktop')
  await page.keyboard.press('n')
  await expect(page.locator('#tx-amount')).toBeFocused()
})

test('has no horizontal scroll', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  expect(overflow).toBe(false)
})
