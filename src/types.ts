export type TxType = 'expense' | 'income'

export interface Transaction {
  id: string
  type: TxType
  amount: number // always positive, in euros
  description: string
  categoryId: string
  date: string // YYYY-MM-DD
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
}

/** Year-month key, e.g. "2026-10" */
export type MonthKey = string
