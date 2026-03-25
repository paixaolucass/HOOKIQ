'use client'

import { useEffect, useState } from 'react'

export default function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // trigger enter animation
    const show = setTimeout(() => setVisible(true), 10)
    // start exit
    const hide = setTimeout(() => setVisible(false), 2600)
    // unmount after exit transition
    const done = setTimeout(onDone, 3000)
    return () => { clearTimeout(show); clearTimeout(hide); clearTimeout(done) }
  }, [onDone])

  return (
    <div
      className="fixed bottom-6 right-6 z-50 px-4 py-3 border border-[#22c55e]/40 bg-[#0a0a0a] text-xs text-[#22c55e] transition-all duration-300"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)' }}
    >
      {message}
    </div>
  )
}
