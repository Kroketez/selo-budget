import type { MonthKey } from './types'

const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })
const moneyWhole = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/** €1,234.50 — negative values use a true minus sign. */
export function formatMoney(value: number, whole = false): string {
  const f = whole ? moneyWhole : money
  const abs = f.format(Math.abs(whole ? Math.round(value) : value))
  return value < 0 && (whole ? Math.round(value) !== 0 : value <= -0.005) ? `−${abs}` : abs
}

export function signedMoney(value: number, type: 'expense' | 'income'): string {
  return `${type === 'income' ? '+' : '−'}${money.format(value)}`
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthOf(date: string): MonthKey {
  return date.slice(0, 7)
}

export function currentMonth(): MonthKey {
  return monthOf(toDateKey(new Date()))
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return toDateKey(d).slice(0, 7)
}

export function monthName(key: MonthKey, withYear = false): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

export function daysInMonth(key: MonthKey): number {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function postmarkParts(date: string): { day: string; month: string } {
  const [y, m, d] = date.split('-').map(Number)
  return {
    day: String(d),
    month: new Date(y, m - 1, d).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
  }
}

export function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
