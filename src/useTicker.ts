import { useEffect, useRef, useState } from 'react'

const reduceMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Animates a number toward its target with an exponential ease-out. */
export function useTicker(target: number, duration = 750): number {
  const [value, setValue] = useState(target)
  const current = useRef(target)

  useEffect(() => {
    const from = current.current
    if (from === target) return
    if (reduceMotion()) {
      current.current = target
      setValue(target)
      return
    }
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
      const next = from + (target - from) * eased
      current.current = next
      setValue(next)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
