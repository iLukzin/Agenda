'use client'
import { useEffect, useRef } from 'react'

export function useVisibilityRefresh(onRefresh: () => void, idleMs = 120000) {
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (typeof window === 'undefined') return
    let lastActive = Date.now()
    let wasHidden = false

    function onVisible() {
      if (document.visibilityState === 'visible') {
        const idle = Date.now() - lastActive
        if (wasHidden && idle > 10000) {
          onRefreshRef.current()
        }
        wasHidden = false
        lastActive = Date.now()
      } else {
        wasHidden = true
        lastActive = Date.now()
      }
    }

    function onFocus() {
      const idle = Date.now() - lastActive
      if (idle > idleMs) {
        onRefreshRef.current()
      }
      lastActive = Date.now()
    }

    function onBlur() {
      lastActive = Date.now()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [idleMs])
}
