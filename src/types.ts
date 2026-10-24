export type TxType = 'expense' | 'income'

/** Year-month key, e.g. "2026-10" */
export type MonthKey = string

export interface Transaction {
  id: string
  type: TxType
  amount: number // always positive, in euros
  description: string
  categoryId: string
  date: string // YYYY-MM-DD
  /** Set when this row comes from a monthly item rather than a one-off entry */
  recurringId?: string
}

/** Something that happens every month: salary, rent, phone plan… */
export interface Recurring {
  id: string
  type: TxType
  amount: number
  description: string
  categoryId: string
  /** Day of the month it lands on (clamped to the month's length) */
  day: number
  /** First month it applies to */
  startMonth: MonthKey
  /** Last month it applies to, or null while it's still running */
  endMonth: MonthKey | null
}

export interface Category {
  id: string
  name: string
  type: TxType
  /** stamp colour */
  color: string
  /** text colour on the stamp */
  ink: string
}

export type Budgets = Record<string, number>

export interface State {
  transactions: Transaction[]
  budgets: Budgets
  recurring: Recurring[]
}
