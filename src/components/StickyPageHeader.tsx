'use client'
import { useEffect, useState, ReactNode } from 'react'

type Props = { children: ReactNode; background?: string }

export default function StickyPageHeader({ children, background = 'white' }: Props) {
  const [topOffset, setTopOffset] = useState(0)
  const [isMob, setIsMob] = useState(false)

  useEffect(() => {
    function update() {
      const mob = window.innerWidth < 768
      setIsMob(mob)
      if (mob) {
        const el = document.getElementById('mobile-header-fixed')
        setTopOffset(el ? el.offsetHeight : 56)
      }
    }
    update()
    const t = setTimeout(update, 200)
    window.addEventListener('resize', update)
    return () => { clearTimeout(t); window.removeEventListener('resize', update) }
  }, [])

  if (!isMob) return <div style={{ background }}>{children}</div>

  return (
    <>
      {/* Versão fixa — visível, não scrollável */}
      <div style={{
        position: 'fixed',
        top: `${topOffset}px`,
        left: 0,
        right: 0,
        zIndex: 19,
        background,
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}>
        {children}
      </div>
      {/* Placeholder invisível para reservar espaço no fluxo */}
      <div style={{ visibility: 'hidden' }} aria-hidden>
        {children}
      </div>
    </>
  )
}
