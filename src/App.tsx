import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, PencilLine } from 'lucide-react'
import type { MonthKey, Recurring, Transaction, TxType } from './types'
import { useBudgetStore, type Storage } from './store'
import { CATEGORY_BY_ID, EXPENSE_CATEGORIES, defaultDateFor, recurringFor } from './data'
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
import { Composer, type ComposerResult, type ComposerTarget } from './components/Composer'
import { MonthlyList } from './components/MonthlyList'
import { TransactionList, type TypeFilter } from './components/TransactionList'

interface Toast {
  id: number
  message: string
  undo?: () => void
}

const STORAGE_NOTES: Record<Storage, string> = {
  checking: "Loading your data…",
  server: "Saved to the database.",
  local: "Sample data, saved only in this browser.",
  offline: "Can’t reach the server. New changes aren’t saved.",
}

export default function App() {
  const [state, dispatch, storage] = useBudgetStore()
  // Read the clock once per page load, not on every render.
  const [todayDate] = useState(() => new Date())
  const todayKey = toDateKey(todayDate)
  const now = monthOf(todayKey)
  const [month, setMonth] = useState<MonthKey>(now)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [composer, setComposer] = useState<ComposerTarget | null>(null)
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
      const spent = [...state.transactions.filter((t) => monthOf(t.date) === m), ...recurringFor(state.recurring, m)]
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0)
      list.push({ key: m, left: totalBudget - spent })
    }
    return list
  }, [state.transactions, state.recurring, now, totalBudget])

  const monthTx = useMemo(
    () =>
      [...state.transactions.filter((t) => monthOf(t.date) === month), ...recurringFor(state.recurring, month)]
        .sort((a, b) => (a.date === b.date ? b.amount - a.amount : b.date.localeCompare(a.date))),
    [state.transactions, state.recurring, month],
  )

  const monthlyItems = useMemo(
    () => state.recurring.filter((r) => r.startMonth <= month && (r.endMonth === null || month <= r.endMonth)),
    [state.recurring, month],
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

  const openComposer = useCallback((target: ComposerTarget) => {
    setComposer(target)
    setComposerKey((k) => k + 1)
    requestAnimationFrame(() => sideRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }, [])

  const openNew = useCallback(
    (type: TxType, repeat = false) => openComposer({ kind: 'new', type, repeat }),
    [openComposer],
  )

  // "N" adds an expense and "I" an income, from anywhere except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.closest('input, textarea, select, [contenteditable="true"]')
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'n' || key === 'i') {
        e.preventDefault()
        openNew(key === 'i' ? 'income' : 'expense')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openNew])

  function selectMonth(m: MonthKey) {
    setMonth(m)
    setComposer(null)
  }

  function handleSave(result: ComposerResult) {
    setComposer(null)
    if (result.kind === 'tx') {
      const { tx, isNew } = result
      dispatch({ type: isNew ? 'add' : 'update', tx })
      const m = monthOf(tx.date)
      if (m !== month) setMonth(m)
      showToast(isNew ? `Added “${tx.description}”.` : `Saved “${tx.description}”.`)
    } else {
      const { item, isNew } = result
      dispatch({ type: isNew ? 'addRecurring' : 'updateRecurring', item })
      if (isNew && item.startMonth > month) setMonth(item.startMonth)
      showToast(
        isNew ? `“${item.description}” now repeats every month.` : `Saved “${item.description}” for every month.`,
      )
    }
  }

  function handleDelete(tx: Transaction) {
    dispatch({ type: 'delete', id: tx.id })
    setComposer(null)
    showToast(`Deleted “${tx.description}”.`, () => dispatch({ type: 'restore', tx }))
  }

  // Stop a monthly item from the month being viewed. Earlier months keep it.
  function handleStopRecurring(item: Recurring) {
    setComposer(null)
    if (item.startMonth >= month) {
      dispatch({ type: 'deleteRecurring', id: item.id })
      showToast(`Removed “${item.description}”.`, () => dispatch({ type: 'addRecurring', item }))
    } else {
      dispatch({ type: 'updateRecurring', item: { ...item, endMonth: shiftMonth(month, -1) } })
      showToast(`“${item.description}” stops from ${monthName(month)}.`, () =>
        dispatch({ type: 'updateRecurring', item }),
      )
    }
  }

  function editRow(tx: Transaction) {
    const item = tx.recurringId ? state.recurring.find((r) => r.id === tx.recurringId) : null
    openComposer(item ? { kind: 'recurring', item } : { kind: 'tx', tx })
  }

  function handleReset() {
    dispatch({ type: 'reset' })
    setMonth(now)
    setCategoryFilter(null)
    setQuery('')
    setTypeFilter('all')
    setComposer(null)
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
        storageNote={STORAGE_NOTES[storage]}
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
              <dt>Income this month</dt>
              <dd className="is-in">+{formatMoney(totals.income)}</dd>
            </div>
            <div>
              <dt>Expenses this month</dt>
              <dd>−{formatMoney(totals.spent)}</dd>
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

          <MonthlyList
            items={monthlyItems}
            monthLabel={label}
            onEdit={(item) => openComposer({ kind: 'recurring', item })}
            onAdd={() => openNew('expense', true)}
          />
        </section>

        <aside className="side" ref={sideRef} aria-label="Transactions">
          {composer && (
            <Composer
              key={composerKey}
              target={composer}
              defaultDate={defaultDateFor(month)}
              presetCategory={categoryFilter}
              onSave={handleSave}
              onDeleteTx={handleDelete}
              onStopRecurring={handleStopRecurring}
              onClose={() => setComposer(null)}
            />
          )}
          <TransactionList
            transactions={visibleTx}
            monthTotal={monthTx.length}
            query={query}
            typeFilter={typeFilter}
            categoryFilter={categoryFilter}
            monthLabel={label}
            selectedId={
              composer?.kind === 'tx'
                ? composer.tx.id
                : composer?.kind === 'recurring'
                  ? `rec-${composer.item.id}-${month}`
                  : null
            }
            today={todayKey}
            onQuery={setQuery}
            onTypeFilter={setTypeFilter}
            onClearCategory={() => setCategoryFilter(null)}
            onClearAll={() => {
              setQuery('')
              setTypeFilter('all')
              setCategoryFilter(null)
            }}
            onSelect={editRow}
            onAdd={() => openNew('expense')}
          />
          <div className="foot-mobile">
            <p>{STORAGE_NOTES[storage]}</p>
            <button type="button" onClick={handleReset}>
              Reset sample data
            </button>
          </div>
        </aside>
      </main>

      <div className="toast-region" role="status" aria-live="polite">
        {storage === 'offline' && !toast && (
          <div className="toast toast-warn">
            <span>{STORAGE_NOTES.offline} Reload once it’s back.</span>
          </div>
        )}
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
