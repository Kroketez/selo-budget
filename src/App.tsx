import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, PencilLine } from 'lucide-react'
import type { MonthKey, Transaction } from './types'
import { useBudgetStore } from './store'
import { CATEGORY_BY_ID, EXPENSE_CATEGORIES, defaultDateFor } from './data'
import {
  toDateKey,
  daysInMonth,
  formatMoney,
  monthName,
  monthOf,
  shiftMonth,
} from './format'
import { useTicker } from './useTicker'
import { Rail } from './components/Rail'
import { Stamp } from './components/Stamp'
import { Composer } from './components/Composer'
import { TransactionList, type TypeFilter } from './components/TransactionList'

interface Toast {
  id: number
  message: string
  undo?: () => void
}

type ComposerState = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; tx: Transaction }

export default function App() {
  const [state, dispatch] = useBudgetStore()
  // Read the clock once per page load, not on every render.
  const [todayDate] = useState(() => new Date())
  const now = monthOf(toDateKey(todayDate))
  const [month, setMonth] = useState<MonthKey>(now)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [composer, setComposer] = useState<ComposerState>({ mode: 'closed' })
  const [composerKey, setComposerKey] = useState(0)
  const [editingBudgets, setEditingBudgets] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const sideRef = useRef<HTMLElement>(null)

  const totalBudget = useMemo(
    () => EXPENSE_CATEGORIES.reduce((s, c) => s + (state.budgets[c.id] ?? 0), 0),
    [state.budgets],
  )

  // Months shown in the rail: two before now through next month, widened to cover any data.
  const months = useMemo(() => {
    let start = shiftMonth(now, -2)
    let end = shiftMonth(now, 1)
    for (const t of state.transactions) {
      const m = monthOf(t.date)
      if (m < start) start = m
      if (m > end) end = m
    }
    const list: { key: MonthKey; left: number }[] = []
    for (let m = start; m <= end; m = shiftMonth(m, 1)) {
      const spent = state.transactions
        .filter((t) => t.type === 'expense' && monthOf(t.date) === m)
        .reduce((s, t) => s + t.amount, 0)
      list.push({ key: m, left: totalBudget - spent })
    }
    return list
  }, [state.transactions, now, totalBudget])

  const monthTx = useMemo(
    () =>
      state.transactions
        .filter((t) => monthOf(t.date) === month)
        .sort((a, b) => (a.date === b.date ? b.amount - a.amount : b.date.localeCompare(a.date))),
    [state.transactions, month],
  )

  const totals = useMemo(() => {
    const spentBy: Record<string, number> = {}
    let income = 0
    let spent = 0
    for (const t of monthTx) {
      if (t.type === 'income') income += t.amount
      else {
        spent += t.amount
        spentBy[t.categoryId] = (spentBy[t.categoryId] ?? 0) + t.amount
      }
    }
    return { income, spent, spentBy, left: totalBudget - spent }
  }, [monthTx, totalBudget])

  const visibleTx = useMemo(() => {
    const q = query.trim().toLowerCase()
    return monthTx.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (categoryFilter && t.categoryId !== categoryFilter) return false
      if (!q) return true
      const cat = CATEGORY_BY_ID[t.categoryId]?.name ?? ''
      return t.description.toLowerCase().includes(q) || cat.toLowerCase().includes(q)
    })
  }, [monthTx, query, typeFilter, categoryFilter])

  const showToast = useCallback((message: string, undo?: () => void) => {
    setToast({ id: Date.now(), message, undo })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 7000)
    return () => clearTimeout(t)
  }, [toast])

  const openNew = useCallback(() => {
    setComposer({ mode: 'new' })
    setComposerKey((k) => k + 1)
    requestAnimationFrame(() => sideRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }, [])

  // "N" opens a new transaction from anywhere except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.closest('input, textarea, select, [contenteditable="true"]')
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        openNew()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openNew])

  function selectMonth(m: MonthKey) {
    setMonth(m)
    setComposer({ mode: 'closed' })
  }

  function handleSave(tx: Transaction, isNew: boolean) {
    dispatch({ type: isNew ? 'add' : 'update', tx })
    setComposer({ mode: 'closed' })
    const m = monthOf(tx.date)
    if (m !== month) setMonth(m)
    showToast(isNew ? `Added “${tx.description}”.` : `Saved “${tx.description}”.`)
  }

  function handleDelete(tx: Transaction) {
    dispatch({ type: 'delete', id: tx.id })
    setComposer({ mode: 'closed' })
    showToast(`Deleted “${tx.description}”.`, () => dispatch({ type: 'restore', tx }))
  }

  function handleReset() {
    dispatch({ type: 'reset' })
    setMonth(now)
    setCategoryFilter(null)
    setQuery('')
    setTypeFilter('all')
    setComposer({ mode: 'closed' })
    showToast('Sample data restored.')
  }

  // Pace: how much per day for the rest of the month.
  const isCurrent = month === now
  const today = todayDate.getDate()
  const daysLeft = isCurrent ? daysInMonth(month) - today + 1 : 0
  const pace =
    month > now
      ? `${monthName(month)} hasn’t started yet.`
      : month < now
        ? `${monthName(month)} is closed.`
        : totals.left > 0
          ? `About ${formatMoney(totals.left / daysLeft)} a day for the next ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}.`
          : `Over budget with ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to go.`

  const tickedLeft = useTicker(totals.left)
  const over = totals.left < 0
  const label = monthName(month)
  const overCount = EXPENSE_CATEGORIES.filter(
    (c) => (totals.spentBy[c.id] ?? 0) > (state.budgets[c.id] ?? 0),
  ).length

  return (
    <div className="app">
      <Rail
        months={months}
        selected={month}
        current={now}
        onSelect={selectMonth}
        onAdd={openNew}
        onReset={handleReset}
      />

      <main className="main" id="main">
        <section className="overview" aria-labelledby="headline">
          <h1 id="headline" className={over ? 'is-over' : ''}>
            <span className="figure">{formatMoney(over ? -tickedLeft : tickedLeft)}</span>
            <span className="figure-label">
              {over ? 'over budget' : 'left to spend'} in {label}
              {month.slice(0, 4) !== now.slice(0, 4) ? ` ${month.slice(0, 4)}` : ''}
            </span>
          </h1>
          <p className="pace">{pace}</p>

          <dl className="summary">
            <div>
              <dt>Income</dt>
              <dd className="is-in">{formatMoney(totals.income)}</dd>
            </div>
            <div>
              <dt>Spent</dt>
              <dd>{formatMoney(totals.spent)}</dd>
            </div>
            <div>
              <dt>Budgeted</dt>
              <dd>{formatMoney(totalBudget)}</dd>
            </div>
            <div>
              <dt>Saved</dt>
              <dd className={totals.income - totals.spent < 0 ? 'is-neg' : ''}>
                {formatMoney(totals.income - totals.spent)}
              </dd>
            </div>
          </dl>

          <section className="budgets" aria-labelledby="budgets-title">
            <div className="budgets-head">
              <h2 id="budgets-title">Budgets</h2>
              <p className="budgets-note">
                {editingBudgets
                  ? 'Set a monthly limit for each category.'
                  : overCount > 0
                    ? `${overCount} ${overCount === 1 ? 'category is' : 'categories are'} over. Select a stamp to filter.`
                    : 'All within budget. Select a stamp to filter.'}
              </p>
              <button
                type="button"
                className={`btn ${editingBudgets ? 'btn-primary' : 'btn-quiet'}`}
                onClick={() => setEditingBudgets((v) => !v)}
              >
                {editingBudgets ? (
                  <>
                    <Check size={16} strokeWidth={2.5} aria-hidden="true" /> Done
                  </>
                ) : (
                  <>
                    <PencilLine size={16} strokeWidth={2} aria-hidden="true" /> Edit budgets
                  </>
                )}
              </button>
            </div>
            <ul className="sheet">
              {EXPENSE_CATEGORIES.map((c) => (
                <Stamp
                  key={c.id}
                  category={c}
                  budget={state.budgets[c.id] ?? 0}
                  spent={totals.spentBy[c.id] ?? 0}
                  monthLabel={label}
                  active={categoryFilter === c.id}
                  editing={editingBudgets}
                  onToggle={() => setCategoryFilter((f) => (f === c.id ? null : c.id))}
                  onBudgetChange={(amount) => dispatch({ type: 'setBudget', categoryId: c.id, amount })}
                />
              ))}
            </ul>
          </section>
        </section>

        <aside className="side" ref={sideRef} aria-label="Transactions">
          {composer.mode !== 'closed' && (
            <Composer
              key={composer.mode === 'edit' ? composer.tx.id : `new-${composerKey}`}
              editing={composer.mode === 'edit' ? composer.tx : null}
              defaultDate={defaultDateFor(month)}
              presetCategory={categoryFilter}
              onSave={handleSave}
              onDelete={handleDelete}
              onClose={() => setComposer({ mode: 'closed' })}
            />
          )}
          <TransactionList
            transactions={visibleTx}
            monthTotal={monthTx.length}
            query={query}
            typeFilter={typeFilter}
            categoryFilter={categoryFilter}
            monthLabel={label}
            selectedId={composer.mode === 'edit' ? composer.tx.id : null}
            onQuery={setQuery}
            onTypeFilter={setTypeFilter}
            onClearCategory={() => setCategoryFilter(null)}
            onClearAll={() => {
              setQuery('')
              setTypeFilter('all')
              setCategoryFilter(null)
            }}
            onSelect={(tx) => {
              setComposer({ mode: 'edit', tx })
              requestAnimationFrame(() =>
                sideRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
              )
            }}
            onAdd={openNew}
          />
          <div className="foot-mobile">
            <p>Sample data, saved only in this browser.</p>
            <button type="button" onClick={handleReset}>
              Reset sample data
            </button>
          </div>
        </aside>
      </main>

      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.()
                  setToast(null)
                }}
              >
                Undo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
