import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Trash2, X } from 'lucide-react'
import type { Transaction, TxType } from '../types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, newId } from '../data'

interface ComposerProps {
  /** Transaction being edited, or null for a new one */
  editing: Transaction | null
  defaultDate: string
  presetCategory: string | null
  onSave: (tx: Transaction, isNew: boolean) => void
  onDelete: (tx: Transaction) => void
  onClose: () => void
}

interface Errors {
  amount?: string
  description?: string
  date?: string
}

export function Composer({ editing, defaultDate, presetCategory, onSave, onDelete, onClose }: ComposerProps) {
  const [type, setType] = useState<TxType>(editing?.type ?? 'expense')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [categoryId, setCategoryId] = useState(
    editing?.categoryId ?? presetCategory ?? EXPENSE_CATEGORIES[0].id,
  )
  const [date, setDate] = useState(editing?.date ?? defaultDate)
  const [errors, setErrors] = useState<Errors>({})
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  function switchType(next: TxType) {
    setType(next)
    const list = next === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
    if (!list.some((c) => c.id === categoryId)) setCategoryId(list[0].id)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount.replace(',', '.'))
    const next: Errors = {}
    if (!amount.trim() || !Number.isFinite(value) || value <= 0)
      next.amount = 'Enter an amount above €0, for example 12.50.'
    else if (value > 1_000_000) next.amount = 'That amount is too large. Keep it under €1,000,000.'
    if (!description.trim()) next.description = 'Add a short description, like the shop name.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = 'Pick a date.'
    setErrors(next)
    if (Object.keys(next).length) {
      const first = next.amount ? 'tx-amount' : next.description ? 'tx-desc' : 'tx-date'
      document.getElementById(first)?.focus()
      return
    }
    onSave(
      {
        id: editing?.id ?? newId(),
        type,
        amount: Math.round(value * 100) / 100,
        description: description.trim(),
        categoryId,
        date,
      },
      !editing,
    )
  }

  const noun = type === 'expense' ? 'expense' : 'income'

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
        <h2 id="composer-title">{editing ? `Edit ${noun}` : `New ${noun}`}</h2>
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

      <div className="field">
        <label htmlFor="tx-desc">Description</label>
        <input
          id="tx-desc"
          autoComplete="off"
          placeholder={type === 'expense' ? 'Pingo Doce' : 'Salary'}
          maxLength={60}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? 'err-desc' : undefined}
        />
        {errors.description && <p className="field-error" id="err-desc">{errors.description}</p>}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="tx-cat">Category</label>
          <select id="tx-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tx-date">Date</label>
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
      </div>

      <div className="composer-actions">
        {editing && (
          <button type="button" className="btn btn-danger" onClick={() => onDelete(editing)}>
            <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
            Delete
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {editing ? 'Save changes' : `Add ${noun}`}
        </button>
      </div>
    </form>
  )
}
