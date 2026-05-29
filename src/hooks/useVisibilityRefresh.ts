'use client'
import { useEffect, useCallback } from 'react'

export function useVisibilityRefresh(onRefresh: () => void, idleMs = 120000) {
  const refresh = useCallback(onRefresh, [onRefresh])

  useEffect(() => {
    let lastActive = Date.now()
    let hidden = false

    function onVisible() {
      if (document.visibilityState === 'visible') {
        const idle = Date.now() - lastActive
        if (hidden && idle > 10000) {
          refresh()
        }
        hidden = false
        lastActive = Date.now()
      } else {
        hidden = true
        lastActive = Date.now()
      }
    }

    function onFocus() {
      const idle = Date.now() - lastActive
      if (idle > idleMs) {
        refresh()
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
  }, [refresh, idleMs])
}
