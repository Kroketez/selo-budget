import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { State, Transaction } from './types'
import { createDemoState } from './data'

const STORAGE_KEY = 'selo-budget:v1'
const API = `${import.meta.env.BASE_URL}api`

export type Action =
  | { type: 'add'; tx: Transaction }
  | { type: 'update'; tx: Transaction }
  | { type: 'delete'; id: string }
  | { type: 'restore'; tx: Transaction }
  | { type: 'setBudget'; categoryId: string; amount: number }
  | { type: 'reset' }

type InternalAction = Action | { type: 'load'; state: State }

/**
 * Where the data lives:
 * - checking: looking for the API server
 * - server: saved in the database (Docker / `npm run server`)
 * - local: no server found (e.g. GitHub Pages), saved in this browser
 * - offline: the server stopped answering; changes are kept in this tab only
 */
export type Storage = 'checking' | 'server' | 'local' | 'offline'

function reducer(state: State, action: InternalAction): State {
  switch (action.type) {
    case 'load':
      return action.state
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
  }
}

function loadLocal(): State {
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

async function request(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`)
  return res.status === 204 ? null : res.json()
}

export function useBudgetStore() {
  const [state, rawDispatch] = useReducer(reducer, undefined, loadLocal)
  const [storage, setStorage] = useState<Storage>('checking')
  const budgetTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Look for the API once. If it answers, the database is the source of truth.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API}/state`, { signal: AbortSignal.timeout(2500) })
        const type = res.headers.get('content-type') ?? ''
        if (!res.ok || !type.includes('application/json')) throw new Error('No API')
        const remote = (await res.json()) as State & { seeded: boolean }
        if (cancelled) return
        if (remote.seeded) {
          rawDispatch({ type: 'load', state: { transactions: remote.transactions, budgets: remote.budgets } })
        } else {
          // Fresh database: fill it with the sample data so the app isn't empty.
          const demo = createDemoState()
          await request('PUT', '/state', demo)
          rawDispatch({ type: 'load', state: demo })
        }
        if (!cancelled) setStorage('server')
      } catch {
        if (!cancelled) setStorage('local')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Without a server, keep the browser copy up to date.
  useEffect(() => {
    if (storage !== 'local') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Private mode or full storage: the app keeps working in memory.
    }
  }, [state, storage])

  const sync = useCallback((work: Promise<unknown>) => {
    work.catch(() => setStorage('offline'))
  }, [])

  const dispatch = useCallback(
    (action: Action) => {
      if (storage !== 'server') {
        rawDispatch(action)
        return
      }
      switch (action.type) {
        case 'add':
        case 'restore':
          rawDispatch(action)
          sync(request('POST', '/transactions', action.tx))
          break
        case 'update':
          rawDispatch(action)
          sync(request('PUT', `/transactions/${action.tx.id}`, action.tx))
          break
        case 'delete':
          rawDispatch(action)
          sync(request('DELETE', `/transactions/${action.id}`))
          break
        case 'setBudget': {
          rawDispatch(action)
          // Budget inputs change on every keystroke: save once typing pauses.
          const { categoryId, amount } = action
          clearTimeout(budgetTimers.current[categoryId])
          budgetTimers.current[categoryId] = setTimeout(
            () => sync(request('PUT', `/budgets/${categoryId}`, { amount })),
            400,
          )
          break
        }
        case 'reset': {
          const demo = createDemoState()
          rawDispatch({ type: 'load', state: demo })
          sync(request('PUT', '/state', demo))
          break
        }
      }
    },
    [storage, sync],
  )

  return [state, dispatch, storage] as const
}
