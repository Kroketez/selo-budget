import type { CSSProperties } from 'react'
import { Repeat, Search, X } from 'lucide-react'
import type { Transaction } from '../types'
import { CATEGORY_BY_ID } from '../data'
import { longDate, postmarkParts, signedMoney } from '../format'

export type TypeFilter = 'all' | 'expense' | 'income'

interface Props {
  transactions: Transaction[] // already filtered
  monthTotal: number
  query: string
  typeFilter: TypeFilter
  categoryFilter: string | null
  monthLabel: string
  selectedId: string | null
  /** YYYY-MM-DD; rows after this are shown as upcoming */
  today: string
  onQuery: (q: string) => void
  onTypeFilter: (t: TypeFilter) => void
  onClearCategory: () => void
  onClearAll: () => void
  onSelect: (tx: Transaction) => void
  onAdd: () => void
}

export function TransactionList({
  transactions,
  monthTotal,
  query,
  typeFilter,
  categoryFilter,
  monthLabel,
  selectedId,
  today,
  onQuery,
  onTypeFilter,
  onClearCategory,
  onClearAll,
  onSelect,
  onAdd,
}: Props) {
  const filtered = query.trim() !== '' || typeFilter !== 'all' || categoryFilter !== null
  const cat = categoryFilter ? CATEGORY_BY_ID[categoryFilter] : null

  return (
    <section className="ledger" aria-labelledby="ledger-title">
      <div className="ledger-head">
        <h2 id="ledger-title">Transactions</h2>
        <span className="count" aria-live="polite">
          {filtered ? `${transactions.length} of ${monthTotal}` : monthTotal}
        </span>
      </div>

      <div className="ledger-tools">
        <div className="search">
          <Search size={16} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search description or category"
            aria-label="Search transactions"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </div>
        <div className="chips" role="group" aria-label="Show">
          {(['all', 'expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              aria-pressed={typeFilter === t}
              onClick={() => onTypeFilter(t)}
            >
              {t === 'all' ? 'All' : t === 'expense' ? 'Expenses' : 'Income'}
            </button>
          ))}
          {cat && (
            <button
              type="button"
              className="chip chip-cat"
              style={{ '--hue': cat.color } as CSSProperties}
              onClick={onClearCategory}
              aria-label={`Remove ${cat.name} filter`}
            >
              <i aria-hidden="true" />
              {cat.name}
              <X size={14} strokeWidth={2.25} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="empty">
          {filtered ? (
            <>
              <p>No transactions match these filters in {monthLabel}.</p>
              <button type="button" className="btn btn-quiet" onClick={onClearAll}>
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p>Nothing posted in {monthLabel} yet.</p>
              <button type="button" className="btn btn-primary" onClick={onAdd}>
                Add the first transaction
              </button>
            </>
          )}
        </div>
      ) : (
        <ol className="tx-list">
          {transactions.map((tx) => {
            const c = CATEGORY_BY_ID[tx.categoryId]
            const pm = postmarkParts(tx.date)
            return (
              <li key={tx.id}>
                <button
                  type="button"
                  className={`tx${selectedId === tx.id ? ' is-selected' : ''}${tx.date > today ? ' is-upcoming' : ''}`}
                  onClick={() => onSelect(tx)}
                  aria-label={`${tx.description}, ${c?.name ?? 'Uncategorised'}, ${longDate(tx.date)}${tx.recurringId ? ', every month' : ''}${tx.date > today ? ', upcoming' : ''}, ${signedMoney(tx.amount, tx.type)}. Edit`}
                >
                  <span className="tx-date" aria-hidden="true">
                    <b>{pm.day}</b>
                    {pm.month}
                  </span>
                  <span className="tx-body">
                    <span className="tx-desc">{tx.description}</span>
                    <span className="tx-cat">
                      <i style={{ background: c?.color }} aria-hidden="true" />
                      {c?.name ?? 'Uncategorised'}
                      {tx.recurringId && (
                        <span className="tag">
                          <Repeat size={12} strokeWidth={2.5} aria-hidden="true" />
                          Monthly
                        </span>
                      )}
                      {tx.date > today && <span className="tag tag-soft">Upcoming</span>}
                    </span>
                  </span>
                  <span className={`tx-amt${tx.type === 'income' ? ' is-in' : ''}`}>
                    {signedMoney(tx.amount, tx.type)}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
