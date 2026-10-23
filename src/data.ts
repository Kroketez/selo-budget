import type { Budgets, Category, State, Transaction } from './types'
import { shiftMonth, currentMonth, daysInMonth, toDateKey } from './format'

export const CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', type: 'expense', color: '#2C67A8', ink: '#FFFFFF' },
  { id: 'home', name: 'Home', type: 'expense', color: '#E2A72E', ink: '#1D1E22' },
  { id: 'transport', name: 'Transport', type: 'expense', color: '#2E7A4F', ink: '#FFFFFF' },
  { id: 'eating', name: 'Eating out', type: 'expense', color: '#A4561A', ink: '#FFFFFF' },
  { id: 'bills', name: 'Bills', type: 'expense', color: '#4E5561', ink: '#FFFFFF' },
  { id: 'fun', name: 'Fun', type: 'expense', color: '#6C4796', ink: '#FFFFFF' },
  { id: 'health', name: 'Health', type: 'expense', color: '#1D7379', ink: '#FFFFFF' },
  { id: 'shopping', name: 'Shopping', type: 'expense', color: '#A23D70', ink: '#FFFFFF' },
  { id: 'salary', name: 'Salary', type: 'income', color: '#2E7A4F', ink: '#FFFFFF' },
  { id: 'freelance', name: 'Freelance', type: 'income', color: '#2E7A4F', ink: '#FFFFFF' },
  { id: 'other-income', name: 'Other income', type: 'income', color: '#2E7A4F', ink: '#FFFFFF' },
]

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))
export const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.type === 'expense')
export const INCOME_CATEGORIES = CATEGORIES.filter((c) => c.type === 'income')

export const DEFAULT_BUDGETS: Budgets = {
  groceries: 400,
  home: 850,
  transport: 120,
  eating: 150,
  bills: 300,
  fun: 100,
  health: 80,
  shopping: 150,
}

type Row = [day: number, description: string, categoryId: string, amount: number]

// Demo data: a believable Lisbon month. Clearly sample data, reset any time.
const BASE: Row[] = [
  [1, 'Salary — Atelier Norte', 'salary', 1850],
  [1, 'Navegante monthly pass', 'transport', 40],
  [2, 'Rent', 'home', 650],
  [3, 'Continente', 'groceries', 62.4],
  [4, 'Café A Brasileira', 'eating', 6.8],
  [5, 'EDP electricity', 'bills', 61.2],
  [6, 'Spotify', 'fun', 10.99],
  [7, 'Pingo Doce', 'groceries', 38.75],
  [8, 'Vodafone fibre', 'bills', 35],
  [9, 'Bolt ride', 'transport', 7.6],
  [10, 'Lidl', 'groceries', 44.1],
  [11, 'Tasca do Zé', 'eating', 27.5],
  [12, 'EPAL water', 'bills', 22.3],
  [13, 'Farmácia Estácio', 'health', 12.85],
  [14, 'Pingo Doce', 'groceries', 51.6],
  [15, 'Cinema NOS', 'fun', 14],
  [16, 'IKEA Alfragide', 'home', 89.9],
  [17, 'Time Out Market', 'eating', 31.2],
  [18, 'Continente', 'groceries', 58.3],
  [19, 'Zara', 'shopping', 45.95],
  [20, 'Freelance — logo project', 'freelance', 450],
  [21, 'Uber', 'transport', 9.4],
  [22, 'Pastelaria Versailles', 'eating', 12.4],
  [23, 'Pingo Doce', 'groceries', 34.18],
  [25, 'Ginásio Fitness Hut', 'health', 29.9],
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

function rowsToTx(month: string, rows: Row[], scale: number, upToDay: number): Transaction[] {
  const days = daysInMonth(month)
  return rows
    .filter(([day]) => day <= Math.min(upToDay, days))
    .map(([day, description, categoryId, amount], i) => {
      const fixed = ['salary', 'home', 'bills'].includes(categoryId) || description.includes('pass')
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
  const transactions = [
    ...rowsToTx(shiftMonth(now, -2), BASE, 0.95, 31),
    ...rowsToTx(shiftMonth(now, -1), BASE, 1.08, 31),
    ...rowsToTx(now, [...BASE, ...CURRENT_EXTRA], 1, today),
  ]
  return { transactions, budgets: { ...DEFAULT_BUDGETS } }
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
