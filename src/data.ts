import type { Budgets, Category, MonthKey, Recurring, State, Transaction } from './types'
import { currentMonth, daysInMonth, shiftMonth, toDateKey } from './format'

export const CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', type: 'expense', color: '#2C67A8', ink: '#FFFFFF' },
  { id: 'home', name: 'Home & bills', type: 'expense', color: '#E2A72E', ink: '#1D1E22' },
  { id: 'transport', name: 'Transport', type: 'expense', color: '#2E7A4F', ink: '#FFFFFF' },
  { id: 'eating', name: 'Eating out', type: 'expense', color: '#A4561A', ink: '#FFFFFF' },
  { id: 'fun', name: 'Fun & shopping', type: 'expense', color: '#6C4796', ink: '#FFFFFF' },
  { id: 'health', name: 'Health', type: 'expense', color: '#1D7379', ink: '#FFFFFF' },
  { id: 'salary', name: 'Salary', type: 'income', color: '#2E7A4F', ink: '#FFFFFF' },
  { id: 'other-income', name: 'Other income', type: 'income', color: '#4E5561', ink: '#FFFFFF' },
]

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))
export const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.type === 'expense')
export const INCOME_CATEGORIES = CATEGORIES.filter((c) => c.type === 'income')

export const DEFAULT_BUDGETS: Budgets = {
  groceries: 400,
  home: 1150,
  transport: 120,
  eating: 150,
  fun: 250,
  health: 80,
}

/** Older versions had 8 expense and 3 income categories; fold them into the current set. */
const MERGED: Record<string, string> = { bills: 'home', shopping: 'fun', freelance: 'other-income' }

/** Bring saved data from any older version up to the current shape. */
export function normalizeState(input: Partial<State>): State {
  const fix = (id: string) => MERGED[id] ?? (CATEGORY_BY_ID[id] ? id : null)
  const transactions = (input.transactions ?? []).map((t) => ({
    ...t,
    categoryId: fix(t.categoryId) ?? (t.type === 'income' ? 'other-income' : 'fun'),
  }))
  const budgets: Budgets = {}
  for (const [id, amount] of Object.entries(input.budgets ?? {})) {
    const target = fix(id)
    if (target && CATEGORY_BY_ID[target].type === 'expense') budgets[target] = (budgets[target] ?? 0) + amount
  }
  for (const c of EXPENSE_CATEGORIES) budgets[c.id] ??= DEFAULT_BUDGETS[c.id]
  const recurring = (input.recurring ?? []).map((r) => ({
    ...r,
    categoryId: fix(r.categoryId) ?? (r.type === 'income' ? 'other-income' : 'fun'),
    endMonth: r.endMonth ?? null,
  }))
  return { transactions, budgets, recurring }
}

/** The rows a monthly item adds to a given month (none if it isn't active then). */
export function recurringFor(items: Recurring[], month: MonthKey): Transaction[] {
  const last = daysInMonth(month)
  return items
    .filter((r) => r.startMonth <= month && (r.endMonth === null || month <= r.endMonth))
    .map((r) => ({
      id: `rec-${r.id}-${month}`,
      type: r.type,
      amount: r.amount,
      description: r.description,
      categoryId: r.categoryId,
      date: `${month}-${String(Math.min(r.day, last)).padStart(2, '0')}`,
      recurringId: r.id,
    }))
}

type Row = [day: number, description: string, categoryId: string, amount: number]

// Demo data: a believable Lisbon month. Clearly sample data, reset any time.
// Fixed monthly things (salary, rent, phone…) are monthly items, not rows here.
const BASE: Row[] = [
  [3, 'Continente', 'groceries', 62.4],
  [4, 'Café A Brasileira', 'eating', 6.8],
  [5, 'EDP electricity', 'home', 61.2],
  [7, 'Pingo Doce', 'groceries', 38.75],
  [9, 'Bolt ride', 'transport', 7.6],
  [10, 'Lidl', 'groceries', 44.1],
  [11, 'Tasca do Zé', 'eating', 27.5],
  [12, 'EPAL water', 'home', 22.3],
  [13, 'Farmácia Estácio', 'health', 12.85],
  [14, 'Pingo Doce', 'groceries', 51.6],
  [15, 'Cinema NOS', 'fun', 14],
  [16, 'IKEA Alfragide', 'home', 89.9],
  [17, 'Time Out Market', 'eating', 31.2],
  [18, 'Continente', 'groceries', 58.3],
  [19, 'Zara', 'fun', 45.95],
  [20, 'Freelance — logo project', 'other-income', 450],
  [21, 'Uber', 'transport', 9.4],
  [22, 'Pastelaria Versailles', 'eating', 12.4],
  [23, 'Pingo Doce', 'groceries', 34.18],
  [26, 'Lidl', 'groceries', 41.2],
  [27, 'Sushi with friends', 'eating', 38],
  [28, 'Bertrand bookshop', 'fun', 18.5],
  [29, 'Continente', 'groceries', 47.9],
  [30, 'CP train to Sintra', 'transport', 4.6],
]

// Extra rows that push "Eating out" over budget in the current month,
// so the over-budget state is visible on first load.
const CURRENT_EXTRA: Row[] = [
  [9, 'Dinner — Cervejaria Ramiro', 'eating', 54.3],
  [15, 'Brunch at Dear Breakfast', 'eating', 22.6],
  [19, 'Pizza night', 'eating', 19.9],
]

const MONTHLY: [day: number, description: string, categoryId: string, amount: number][] = [
  [1, 'Salary — Atelier Norte', 'salary', 1850],
  [1, 'Navegante monthly pass', 'transport', 40],
  [2, 'Rent', 'home', 650],
  [6, 'Spotify', 'fun', 10.99],
  [8, 'Vodafone fibre', 'home', 35],
  [25, 'Gym — Fitness Hut', 'health', 29.9],
]

function rowsToTx(month: string, rows: Row[], scale: number, upToDay: number): Transaction[] {
  const days = daysInMonth(month)
  return rows
    .filter(([day]) => day <= Math.min(upToDay, days))
    .map(([day, description, categoryId, amount], i) => {
      const fixed = categoryId === 'other-income'
      const value = fixed ? amount : Math.round(amount * scale * (0.9 + ((i * 37) % 20) / 100) * 100) / 100
      return {
        id: `${month}-${i}-${categoryId}`,
        type: CATEGORY_BY_ID[categoryId].type,
        amount: value,
        description,
        categoryId,
        date: `${month}-${String(day).padStart(2, '0')}`,
      }
    })
}

export function createDemoState(): State {
  const now = currentMonth()
  const today = new Date().getDate()
  const start = shiftMonth(now, -2)
  const transactions = [
    ...rowsToTx(start, BASE, 0.95, 31),
    ...rowsToTx(shiftMonth(now, -1), BASE, 1.08, 31),
    ...rowsToTx(now, [...BASE, ...CURRENT_EXTRA], 1, today),
  ]
  const recurring: Recurring[] = MONTHLY.map(([day, description, categoryId, amount], i) => ({
    id: `monthly-${i}-${categoryId}`,
    type: CATEGORY_BY_ID[categoryId].type,
    amount,
    description,
    categoryId,
    day,
    startMonth: start,
    endMonth: null,
  }))
  return { transactions, budgets: { ...DEFAULT_BUDGETS }, recurring }
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function defaultDateFor(month: string): string {
  const today = toDateKey(new Date())
  return today.startsWith(month) ? today : `${month}-01`
}
