import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { Category } from '../types'
import { formatMoney } from '../format'
import { useTicker } from '../useTicker'

interface StampProps {
  category: Category
  budget: number
  spent: number
  monthLabel: string
  active: boolean
  editing: boolean
  onToggle: () => void
  onBudgetChange: (amount: number) => void
}

export function Stamp({
  category,
  budget,
  spent,
  monthLabel,
  active,
  editing,
  onToggle,
  onBudgetChange,
}: StampProps) {
  const left = budget - spent
  const over = left < 0
  const ticked = useTicker(left)
  const used = budget > 0 ? Math.min(1, spent / budget) : spent > 0 ? 1 : 0

  // Play the cancellation only when a stamp crosses into "over", not on first paint.
  const wasOver = useRef(over)
  const [justCancelled, setJustCancelled] = useState(false)
  useEffect(() => {
    if (over && !wasOver.current) {
      setJustCancelled(true)
      const t = setTimeout(() => setJustCancelled(false), 1200)
      wasOver.current = over
      return () => clearTimeout(t)
    }
    wasOver.current = over
  }, [over])

  const style = { '--hue': category.color, '--stamp-ink': category.ink } as CSSProperties
  const status = over
    ? `${formatMoney(-left)} over the ${formatMoney(budget, true)} budget`
    : `${formatMoney(left)} left of ${formatMoney(budget, true)}`

  const face = (
    <>
      <span className="stamp-name">{category.name}</span>
      <span className="stamp-value" aria-hidden="true">
        {formatMoney(ticked, true)}
      </span>
      {editing ? (
        <label className="stamp-budget">
          <span>Budget</span>
          <span className="stamp-budget-field">
            €
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={10}
              defaultValue={budget}
              aria-label={`${category.name} monthly budget in euros`}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n) && n >= 0) onBudgetChange(n)
              }}
            />
          </span>
        </label>
      ) : (
        <span className="stamp-of">
          {over ? `over ${formatMoney(budget, true)}` : `left of ${formatMoney(budget, true)}`}
        </span>
      )}
      <span className="stamp-meter" aria-hidden="true">
        <i style={{ inlineSize: `${used * 100}%` }} />
      </span>
    </>
  )

  return (
    <li className={`stamp${over ? ' is-over' : ''}${active ? ' is-active' : ''}`} style={style}>
      {editing ? (
        <div className="stamp-face">{face}</div>
      ) : (
        <button
          type="button"
          className="stamp-face"
          aria-pressed={active}
          aria-label={`${category.name}: ${status}. ${active ? 'Showing only' : 'Show only'} ${category.name} transactions`}
          onClick={onToggle}
        >
          {face}
        </button>
      )}
      {over && <Postmark label={`OVER · ${monthLabel.slice(0, 3).toUpperCase()}`} animate={justCancelled} />}
    </li>
  )
}

function Postmark({ label, animate }: { label: string; animate: boolean }) {
  const arcId = useId()
  return (
    <svg
      className={`postmark${animate ? ' is-stamping' : ''}`}
      viewBox="0 0 220 90"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <path id={arcId} d="M 18 45 a 27 27 0 1 1 54 0 a 27 27 0 1 1 -54 0" />
      </defs>
      <circle cx="45" cy="45" r="36" />
      <circle cx="45" cy="45" r="20" />
      <text className="postmark-text">
        <textPath href={`#${arcId}`} startOffset="2%">
          {label} · {label}
        </textPath>
      </text>
      {[24, 36, 48, 60, 72].map((y, i) => (
        <path
          key={y}
          className="wave"
          style={{ animationDelay: `${120 + i * 50}ms` }}
          d={`M 86 ${y} q 11 -7 22 0 t 22 0 t 22 0 t 22 0 t 22 0 t 22 0`}
        />
      ))}
    </svg>
  )
}
