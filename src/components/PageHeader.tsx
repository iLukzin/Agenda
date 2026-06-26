// BUILD: 1782432799
'use client'
import { useEffect, useState, useRef, ReactNode } from 'react'

// Mede a altura do header fixo do layout mobile e do header desta página
// para posicionar tudo corretamente
export default function PageHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [layoutH, setLayoutH] = useState(0)
  const [pageH,   setPageH]   = useState(0)
  const [isMob,   setIsMob]   = useState(false)

  useEffect(() => {
    function update() {
      const mob = window.innerWidth < 768
      setIsMob(mob)
      if (mob) {
        const lh = document.getElementById('mobile-header-fixed')?.offsetHeight ?? 56
        setLayoutH(lh)
        setPageH(ref.current?.offsetHeight ?? 0)
      }
    }
    update()
    const t = setTimeout(update, 200)
    window.addEventListener('resize', update)
    return () => { clearTimeout(t); window.removeEventListener('resize', update) }
  }, [])

  // Quando o conteúdo dentro muda, recalcula a altura
  useEffect(() => {
    if (ref.current && isMob) setPageH(ref.current.offsetHeight)
  })

  if (!isMob) {
    // Desktop: sticky normal (scroll está no main)
    return (
      <div style={{ position:'sticky', top:0, zIndex:20, background:'white', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
        {children}
      </div>
    )
  }

  return (
    <>
      {/* Versão fixa — colada abaixo do header do layout */}
      <div
        ref={ref}
        style={{
          position: 'fixed',
          top: `${layoutH}px`,
          left: 0,
          right: 0,
          zIndex: 25,
          background: 'white',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}
      >
        {children}
      </div>
      {/* Espaçador invisível para reservar o espaço no fluxo */}
      <div style={{ height: `${pageH}px`, flexShrink: 0 }} aria-hidden />
    </>
  )
}
