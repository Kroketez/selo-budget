import { Plus, Repeat } from 'lucide-react'
import type { Recurring } from '../types'
import { CATEGORY_BY_ID } from '../data'
import { formatMoney, signedMoney } from '../format'

interface Props {
  items: Recurring[] // active in the selected month
  monthLabel: string
  onEdit: (item: Recurring) => void
  onAdd: () => void
}

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${s}`
}

export function MonthlyList({ items, monthLabel, onEdit, onAdd }: Props) {
  const sorted = [...items].sort((a, b) => (a.type === b.type ? a.day - b.day : a.type === 'income' ? -1 : 1))
  const inTotal = items.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0)
  const outTotal = items.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0)

  return (
    <section className="monthly" aria-labelledby="monthly-title">
      <div className="section-head">
        <h2 id="monthly-title">Every month</h2>
        <p className="section-note">
          {items.length
            ? `${formatMoney(inTotal)} in, ${formatMoney(outTotal)} out, added automatically.`
            : `Nothing repeats in ${monthLabel}. Add your salary, rent or subscriptions once.`}
        </p>
        <button type="button" className="btn btn-quiet" onClick={onAdd}>
          <Plus size={16} strokeWidth={2.25} aria-hidden="true" /> Add monthly item
        </button>
      </div>
      {sorted.length > 0 && (
        <ul className="monthly-list">
          {sorted.map((r) => {
            const c = CATEGORY_BY_ID[r.categoryId]
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className="monthly-row"
                  onClick={() => onEdit(r)}
                  aria-label={`${r.description}, ${signedMoney(r.amount, r.type)} on the ${ordinal(r.day)} of every month. Edit`}
                >
                  <span className="monthly-day" aria-hidden="true">
                    {ordinal(r.day)}
                  </span>
                  <span className="monthly-desc">
                    {r.description}
                    <small>
                      <i style={{ background: c?.color }} aria-hidden="true" />
                      {c?.name}
                    </small>
                  </span>
                  <span className={`tx-amt${r.type === 'income' ? ' is-in' : ''}`}>{signedMoney(r.amount, r.type)}</span>
                  <Repeat className="monthly-icon" size={14} strokeWidth={2.25} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
