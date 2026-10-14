import { useEffect, useRef, useState } from 'react'
import { cx } from './ui'

// Fades and slides content up the first time it scrolls into view.
// Wraps a block; put hover effects on the inner element so their
// transitions aren't affected by the reveal delay.
export default function Reveal({ as, delay = 0, className, children, ...props }) {
  const Tag = as ?? 'div'
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // No IntersectionObserver (jsdom, very old browsers): show immediately.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return undefined
    }
    const el = ref.current
    if (!el) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag ref={ref} className={cx('reveal', shown && 'is-shown', className)} style={{ transitionDelay: `${delay}ms` }} {...props}>
      {children}
    </Tag>
  )
}
