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
const monthlyRow = (page: Page, text: string) => page.locator('.monthly-row', { hasText: text })

async function openComposer(page: Page, type: 'expense' | 'income' = 'expense') {
  await page.getByRole('button', { name: type === 'expense' ? 'New expense' : 'New income' }).click()
  await expect(page.locator('#tx-amount')).toBeFocused()
}

async function addExpense(page: Page, amount: string, note: string, category: string, repeat = false) {
  await openComposer(page)
  await page.fill('#tx-amount', amount)
  await page.getByRole('radio', { name: category }).check()
  await page.fill('#tx-desc', note)
  if (repeat) await page.getByRole('checkbox', { name: /Repeat every month/ }).check()
  await page.getByRole('button', { name: repeat ? 'Add monthly expense' : 'Add expense' }).click()
}

async function goToNovember(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: 'Next month' }).click()
  else await page.getByRole('navigation', { name: 'Months' }).getByRole('button', { name: /November/ }).click()
}

test('shows the month overview with sample data', async ({ page }) => {
  await expect(page.locator('#headline')).toContainText('left to spend in October')
  await expect(headline(page)).toHaveText('€672.13')
  await expect(page.locator('.summary')).toContainText('Income this month')
  await expect(page.locator('.summary')).toContainText('Expenses this month')
  await expect(page.locator('.stamp')).toHaveCount(6)
  await expect(stamp(page, 'Eating out')).toHaveClass(/is-over/)
  await expect(page.locator('.monthly-row')).toHaveCount(6)
  await expect(page.locator('.pace')).toContainText('a day for the next 9 days')
})

test('only the amount is required', async ({ page }) => {
  await openComposer(page)
  await page.getByRole('button', { name: 'Add expense' }).click()
  await expect(page.locator('#err-amount')).toBeVisible()
  await expect(page.locator('#tx-amount')).toBeFocused()

  // No note: the category name is used as the description.
  await page.fill('#tx-amount', '3.20')
  await page.getByRole('radio', { name: 'Transport' }).check()
  await page.getByRole('button', { name: 'Add expense' }).click()
  await expect(row(page, 'Transport').first()).toContainText('−€3.20')
})

test('adds income from its own button', async ({ page }) => {
  await openComposer(page, 'income')
  await expect(page.locator('#composer-title')).toHaveText('New income')
  await page.fill('#tx-amount', '120')
  await page.getByRole('radio', { name: 'Other income' }).check()
  await page.fill('#tx-desc', 'Sold old bike')
  await page.getByRole('button', { name: 'Add income' }).click()
  await expect(row(page, 'Sold old bike')).toContainText('+€120.00')
})

test('adding an expense lowers the stamp and cancels it when over', async ({ page }) => {
  await expect(stamp(page, 'Groceries')).not.toHaveClass(/is-over/)
  await addExpense(page, '150', 'Big Continente shop', 'Groceries')

  await expect(page.locator('.composer')).toBeHidden()
  await expect(row(page, 'Big Continente shop')).toBeVisible()
  await expect(headline(page)).toHaveText('€522.13')
  await expect(stamp(page, 'Groceries')).toHaveClass(/is-over/)
  await expect(page.locator('.toast')).toContainText('Added')
})

test('edits a transaction', async ({ page }) => {
  await addExpense(page, '150', 'Big Continente shop', 'Groceries')
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
  await expect(page.locator('.tx')).toHaveCount(27)

  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('.tx')).toHaveCount(28)
})

test('a monthly item repeats in every month', async ({ page, isMobile }) => {
  await addExpense(page, '15.99', 'Netflix', 'Fun & shopping', true)
  await expect(monthlyRow(page, 'Netflix')).toContainText('23rd')
  await expect(row(page, 'Netflix')).toContainText('Monthly')

  await goToNovember(page, isMobile)
  await expect(row(page, 'Netflix')).toBeVisible()
  await expect(row(page, 'Rent')).toBeVisible()
})

test('editing a monthly item changes every month', async ({ page, isMobile }) => {
  await monthlyRow(page, 'Rent').click()
  await expect(page.locator('#composer-title')).toHaveText('Monthly expense')
  await page.fill('#tx-amount', '700')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(row(page, 'Rent')).toContainText('−€700.00')

  await goToNovember(page, isMobile)
  await expect(row(page, 'Rent')).toContainText('−€700.00')
})

test('stopping a monthly item keeps earlier months', async ({ page, isMobile }) => {
  await goToNovember(page, isMobile)
  await monthlyRow(page, 'Spotify').click()
  await page.getByRole('button', { name: 'Stop repeating' }).click()
  await expect(row(page, 'Spotify')).toHaveCount(0)
  await expect(page.locator('.toast')).toContainText('stops from November')

  if (isMobile) await page.getByRole('button', { name: 'Previous month' }).click()
  else await page.getByRole('navigation', { name: 'Months' }).getByRole('button', { name: /October/ }).click()
  await expect(row(page, 'Spotify')).toBeVisible()
})

test('filters by stamp, type and search', async ({ page }) => {
  await stamp(page, 'Eating out').getByRole('button').click()
  await expect(page.locator('.tx')).toHaveCount(7)
  for (const cat of await page.locator('.tx-cat').allTextContents()) expect(cat).toContain('Eating out')

  await page.getByRole('button', { name: 'Remove Eating out filter' }).click()
  await page.getByRole('button', { name: 'Income', exact: true }).click()
  for (const amt of await page.locator('.tx .tx-amt').allTextContents()) expect(amt.startsWith('+')).toBe(true)

  await page.getByRole('button', { name: 'All', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search transactions' }).fill('zzzz')
  await expect(page.getByText('No transactions match')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.locator('.tx')).toHaveCount(28)
})

test('edits a budget', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit budgets' }).click()
  await page.getByLabel('Eating out monthly budget in euros').fill('400')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(stamp(page, 'Eating out')).not.toHaveClass(/is-over/)
  await expect(stamp(page, 'Eating out')).toContainText('left of €400')
})

test('saves to the browser and restores sample data on reset', async ({ page }) => {
  await addExpense(page, '12.50', 'Saved coffee', 'Eating out')
  await page.reload()
  await expect(row(page, 'Saved coffee')).toBeVisible()

  await page.getByRole('button', { name: 'Reset sample data' }).click()
  await expect(row(page, 'Saved coffee')).toHaveCount(0)
  await expect(headline(page)).toHaveText('€672.13')
})

test('converts data saved with the old categories', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'selo-budget:v1',
      JSON.stringify({
        transactions: [
          { id: 'a', type: 'expense', amount: 40, description: 'Old shoes', categoryId: 'shopping', date: '2026-10-10' },
          { id: 'b', type: 'expense', amount: 60, description: 'Old bill', categoryId: 'bills', date: '2026-10-11' },
        ],
        budgets: { home: 800, bills: 200, fun: 100, shopping: 50 },
        recurring: [],
      }),
    ),
  )
  await page.reload()
  await expect(row(page, 'Old shoes')).toContainText('Fun & shopping')
  await expect(row(page, 'Old bill')).toContainText('Home & bills')
  await expect(stamp(page, 'Home & bills')).toContainText('of €1,000')
  await expect(stamp(page, 'Fun & shopping')).toContainText('of €150')
})

test('future months show the monthly items', async ({ page, isMobile }) => {
  await goToNovember(page, isMobile)
  await expect(page.locator('.pace')).toContainText('hasn’t started yet')
  await expect(page.locator('.tx')).toHaveCount(6)
})

test('keyboard shortcuts open the form on desktop', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keyboard shortcuts are for desktop')
  await page.keyboard.press('n')
  await expect(page.locator('#composer-title')).toHaveText('New expense')
  await page.keyboard.press('Escape')
  await page.keyboard.press('i')
  await expect(page.locator('#composer-title')).toHaveText('New income')
})

test('has no horizontal scroll', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  expect(overflow).toBe(false)
})
