'use client'
import { useEffect, useState, ReactNode } from 'react'

type Props = {
  children: ReactNode
  background?: string
}

// Calcula o top correto baseado na altura real do header mobile fixo
function useHeaderTop() {
  const [top, setTop] = useState(56)
  useEffect(() => {
    function medir() {
      const el = document.getElementById('mobile-header-fixed')
      setTop(el ? el.offsetHeight : 0)
    }
    medir()
    const t = setTimeout(medir, 150)
    window.addEventListener('resize', medir)
    return () => { clearTimeout(t); window.removeEventListener('resize', medir) }
  }, [])
  return top
}

// Só aplica sticky no mobile (largura < 768px)
function useIsMobile() {
  const [mob, setMob] = useState(false)
  useEffect(() => {
    const check = () => setMob(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return mob
}

export default function StickyPageHeader({ children, background = 'white' }: Props) {
  const isMobile = useIsMobile()
  const top      = useHeaderTop()

  if (!isMobile) {
    // Desktop: sem sticky (sidebar já é fixa, não precisa)
    return <div style={{ background }}>{children}</div>
  }

  return (
    <div style={{
      position: 'sticky',
      top: `${top}px`,
      zIndex: 20,
      background,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {children}
    </div>
  )
}
