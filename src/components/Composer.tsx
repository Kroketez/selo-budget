import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Repeat, Square, X } from 'lucide-react'
import type { Recurring, Transaction, TxType } from '../types'
import { CATEGORY_BY_ID, EXPENSE_CATEGORIES, INCOME_CATEGORIES, newId } from '../data'
import { monthName, monthOf } from '../format'

export type ComposerTarget =
  | { kind: 'new'; type: TxType; repeat?: boolean }
  | { kind: 'tx'; tx: Transaction }
  | { kind: 'recurring'; item: Recurring }

export type ComposerResult =
  | { kind: 'tx'; tx: Transaction; isNew: boolean }
  | { kind: 'recurring'; item: Recurring; isNew: boolean }

interface ComposerProps {
  target: ComposerTarget
  defaultDate: string
  presetCategory: string | null
  onSave: (result: ComposerResult) => void
  onDeleteTx: (tx: Transaction) => void
  onStopRecurring: (item: Recurring) => void
  onClose: () => void
}

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${s}`
}

export function Composer({
  target,
  defaultDate,
  presetCategory,
  onSave,
  onDeleteTx,
  onStopRecurring,
  onClose,
}: ComposerProps) {
  const existing = target.kind === 'tx' ? target.tx : target.kind === 'recurring' ? target.item : null
  const isRecurringEdit = target.kind === 'recurring'

  const [type, setType] = useState<TxType>(existing?.type ?? (target.kind === 'new' ? target.type : 'expense'))
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const firstCategory = (t: TxType) => (t === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)[0].id
  const [categoryId, setCategoryId] = useState(() => {
    if (existing) return existing.categoryId
    const preset = presetCategory ? CATEGORY_BY_ID[presetCategory] : null
    return preset && preset.type === type ? preset.id : firstCategory(type)
  })
  // The note is optional: an empty note falls back to the category name.
  const [note, setNote] = useState(() => {
    if (!existing) return ''
    return existing.description === CATEGORY_BY_ID[existing.categoryId]?.name ? '' : existing.description
  })
  const [date, setDate] = useState(target.kind === 'tx' ? target.tx.date : defaultDate)
  const [day, setDay] = useState(isRecurringEdit ? String(target.item.day) : '')
  const [repeat, setRepeat] = useState(target.kind === 'new' && !!target.repeat)
  const [errors, setErrors] = useState<{ amount?: string; date?: string; day?: string }>({})
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  function switchType(next: TxType) {
    setType(next)
    if (CATEGORY_BY_ID[categoryId]?.type !== next) setCategoryId(firstCategory(next))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount.replace(',', '.'))
    const dayValue = Number(day)
    const next: typeof errors = {}
    if (!amount.trim() || !Number.isFinite(value) || value <= 0)
      next.amount = 'Enter an amount above €0, for example 12.50.'
    else if (value > 1_000_000) next.amount = 'That amount is too large. Keep it under €1,000,000.'
    if (isRecurringEdit) {
      if (!Number.isInteger(dayValue) || dayValue < 1 || dayValue > 31) next.day = 'Pick a day from 1 to 31.'
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = 'Pick a date.'
    setErrors(next)
    if (Object.keys(next).length) {
      document.getElementById(next.amount ? 'tx-amount' : next.day ? 'tx-day' : 'tx-date')?.focus()
      return
    }

    const fields = {
      type,
      amount: Math.round(value * 100) / 100,
      description: note.trim() || CATEGORY_BY_ID[categoryId].name,
      categoryId,
    }
    if (target.kind === 'recurring') {
      onSave({ kind: 'recurring', item: { ...target.item, ...fields, day: dayValue }, isNew: false })
    } else if (target.kind === 'new' && repeat) {
      onSave({
        kind: 'recurring',
        isNew: true,
        item: {
          id: newId(),
          ...fields,
          day: Number(date.slice(8, 10)),
          startMonth: monthOf(date),
          endMonth: null,
        },
      })
    } else {
      onSave({
        kind: 'tx',
        isNew: target.kind === 'new',
        tx: { id: target.kind === 'tx' ? target.tx.id : newId(), ...fields, date },
      })
    }
  }

  const noun = type === 'expense' ? 'expense' : 'income'
  const title = isRecurringEdit
    ? `Monthly ${noun}`
    : target.kind === 'tx'
      ? `Edit ${noun}`
      : `New ${noun}`
  const submitLabel = existing ? 'Save changes' : repeat ? `Add monthly ${noun}` : `Add ${noun}`

  return (
    <form
      className="composer"
      onSubmit={submit}
      noValidate
      aria-labelledby="composer-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div className="composer-head">
        <h2 id="composer-title">{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close form">
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <fieldset className="segmented">
        <legend className="sr-only">Type</legend>
        {(['expense', 'income'] as const).map((t) => (
          <label key={t} className={type === t ? 'is-on' : ''}>
            <input type="radio" name="tx-type" value={t} checked={type === t} onChange={() => switchType(t)} />
            {t === 'expense' ? 'Expense' : 'Income'}
          </label>
        ))}
      </fieldset>

      <div className="field field-amount">
        <label htmlFor="tx-amount">Amount</label>
        <div className="money-input">
          <span aria-hidden="true">€</span>
          <input
            id="tx-amount"
            ref={amountRef}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount ? 'err-amount' : undefined}
          />
        </div>
        {errors.amount && <p className="field-error" id="err-amount">{errors.amount}</p>}
      </div>

      <fieldset className="field cat-picker">
        <legend>Category</legend>
        <div className="cat-chips">
          {categories.map((c) => (
            <label
              key={c.id}
              className={`cat-chip${categoryId === c.id ? ' is-on' : ''}`}
              style={{ '--hue': c.color, '--stamp-ink': c.ink } as CSSProperties}
            >
              <input
                type="radio"
                name="tx-cat"
                value={c.id}
                checked={categoryId === c.id}
                onChange={() => setCategoryId(c.id)}
              />
              <Square size={12} strokeWidth={0} fill="currentColor" className="cat-swatch" aria-hidden="true" />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="tx-desc">
          Note <span className="optional">optional</span>
        </label>
        <input
          id="tx-desc"
          autoComplete="off"
          placeholder={CATEGORY_BY_ID[categoryId]?.name}
          maxLength={60}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {isRecurringEdit ? (
        <div className="field">
          <label htmlFor="tx-day">Day of the month</label>
          <input
            id="tx-day"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={day}
            onChange={(e) => setDay(e.target.value)}
            aria-invalid={!!errors.day}
            aria-describedby={errors.day ? 'err-day' : 'day-hint'}
          />
          {errors.day ? (
            <p className="field-error" id="err-day">{errors.day}</p>
          ) : (
            <p className="field-hint" id="day-hint">
              <Repeat size={14} strokeWidth={2.25} aria-hidden="true" />
              Every month since {monthName(target.item.startMonth, true)}. Changes apply to every month.
            </p>
          )}
        </div>
      ) : (
        <div className="field-row">
          <div className="field">
            <label htmlFor="tx-date">{repeat ? 'Starts on' : 'Date'}</label>
            <input
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!errors.date}
              aria-describedby={errors.date ? 'err-date' : undefined}
            />
            {errors.date && <p className="field-error" id="err-date">{errors.date}</p>}
          </div>
          {target.kind === 'new' && (
            <label className="repeat-toggle">
              <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
              <span>
                Repeat every month
                {repeat && /^\d{4}-\d{2}-\d{2}$/.test(date) && (
                  <small>on the {ordinal(Number(date.slice(8, 10)))}</small>
                )}
              </span>
            </label>
          )}
        </div>
      )}

      <div className="composer-actions">
        {target.kind === 'tx' && (
          <button type="button" className="btn btn-danger" onClick={() => onDeleteTx(target.tx)}>
            Delete
          </button>
        )}
        {isRecurringEdit && (
          <button type="button" className="btn btn-danger" onClick={() => onStopRecurring(target.item)}>
            Stop repeating
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
