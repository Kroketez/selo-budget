import { useEffect, useReducer } from 'react'
import type { State, Transaction } from './types'
import { createDemoState } from './data'

const STORAGE_KEY = 'selo-budget:v1'

export type Action =
  | { type: 'add'; tx: Transaction }
  | { type: 'update'; tx: Transaction }
  | { type: 'delete'; id: string }
  | { type: 'restore'; tx: Transaction }
  | { type: 'setBudget'; categoryId: string; amount: number }
  | { type: 'reset' }
  | { type: 'clear' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add':
    case 'restore':
      return { ...state, transactions: [...state.transactions, action.tx] }
    case 'update':
      return {
        ...state,
        transactions: state.transactions.map((t) => (t.id === action.tx.id ? action.tx : t)),
      }
    case 'delete':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) }
    case 'setBudget':
      return { ...state, budgets: { ...state.budgets, [action.categoryId]: action.amount } }
    case 'reset':
      return createDemoState()
    case 'clear':
      return { ...state, transactions: [] }
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as State
      if (Array.isArray(parsed.transactions) && parsed.budgets) return parsed
    }
  } catch {
    // Storage blocked or corrupted: fall back to demo data.
  }
  return createDemoState()
}

export function useBudgetStore() {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Private mode or full storage: the app keeps working in memory.
    }
  }, [state])
  return [state, dispatch] as const
}
