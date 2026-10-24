import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from 'lucide-react'
import type { MonthKey, TxType } from '../types'
import { formatMoney, monthName, shiftMonth } from '../format'

interface RailProps {
  months: { key: MonthKey; left: number }[]
  selected: MonthKey
  current: MonthKey
  onSelect: (m: MonthKey) => void
  onAdd: (type: TxType) => void
  onReset: () => void
  storageNote: string
}

export function Rail({ months, selected, current, onSelect, onAdd, onReset, storageNote }: RailProps) {
  const first = months[0]?.key
  const last = months[months.length - 1]?.key
  return (
    <header className="rail">
      <div className="brand">
        <Logo />
        <span>
          Selo
          <small>monthly budget</small>
        </span>
      </div>

      {/* Mobile: month stepper */}
      <div className="month-stepper">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous month"
          disabled={selected === first}
          onClick={() => onSelect(shiftMonth(selected, -1))}
        >
          <ChevronLeft size={20} strokeWidth={2.25} />
        </button>
        <span aria-live="polite">{monthName(selected, true)}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next month"
          disabled={selected === last}
          onClick={() => onSelect(shiftMonth(selected, 1))}
        >
          <ChevronRight size={20} strokeWidth={2.25} />
        </button>
      </div>

      {/* Desktop: month list */}
      <nav className="months" aria-label="Months">
        <ol>
          {[...months].reverse().map((m) => (
            <li key={m.key}>
              <button
                type="button"
                aria-current={m.key === selected ? 'page' : undefined}
                onClick={() => onSelect(m.key)}
              >
                <span>
                  {monthName(m.key)}
                  {m.key === current && <em>now</em>}
                </span>
                <span className={`months-left${m.left < 0 ? ' is-neg' : ''}`}>
                  {formatMoney(m.left, true)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="add-group">
        <button
          type="button"
          className="add-btn add-income"
          onClick={() => onAdd('income')}
          aria-keyshortcuts="i"
          aria-label="New income"
        >
          <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
          <span>Income</span>
        </button>
        <button
          type="button"
          className="add-btn add-expense"
          onClick={() => onAdd('expense')}
          aria-keyshortcuts="n"
          aria-label="New expense"
        >
          <Minus size={18} strokeWidth={2.5} aria-hidden="true" />
          <span>Expense</span>
        </button>
      </div>

      <div className="rail-foot">
        <p aria-live="polite">{storageNote}</p>
        <button type="button" onClick={onReset}>
          <RotateCcw size={14} strokeWidth={2.25} aria-hidden="true" />
          Reset sample data
        </button>
      </div>
    </header>
  )
}

function Logo() {
  // A tiny perforated stamp mark.
  return (
    <svg className="logo" viewBox="0 0 36 44" aria-hidden="true" focusable="false">
      <defs>
        <mask id="logo-perf">
          <rect width="36" height="44" fill="#fff" />
          {Array.from({ length: 6 }, (_, i) => (
            <g key={i} fill="#000">
              <circle cx={3 + i * 6} cy="0" r="2" />
              <circle cx={3 + i * 6} cy="44" r="2" />
            </g>
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <g key={`v${i}`} fill="#000">
              <circle cx="0" cy={4 + i * 6} r="2" />
              <circle cx="36" cy={4 + i * 6} r="2" />
            </g>
          ))}
        </mask>
      </defs>
      <rect width="36" height="44" fill="#fff" mask="url(#logo-perf)" />
      <rect x="6" y="6" width="24" height="32" fill="#D7202C" />
      <text x="18" y="29" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="800" fontFamily="Archivo Variable, sans-serif">
        €
      </text>
    </svg>
  )
}
